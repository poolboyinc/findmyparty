using FindMyParty.Identity.API.Application.DTOs;
using FindMyParty.Identity.API.Application.Services;
using FindMyParty.Identity.API.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace FindMyParty.Identity.API.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController(
        UserManager<ApplicationUser> userManager,
        ITokenService tokenService,
        IExternalAuthService externalAuthService,
        ILogger<AuthController> logger) : ControllerBase
    {
        [HttpPost("register")]
        public async Task<IActionResult> Register(RegisterRequest request)
        {
            var user = new ApplicationUser
            {
                UserName = request.UserName,
                Email = request.Email,
                Subscription = Domain.Enums.SubscriptionType.Free
            };

            var result = await userManager.CreateAsync(user, request.Password);

            if (!result.Succeeded)
                return BadRequest(result.Errors);

            await userManager.AddToRoleAsync(user, "User");

            var accessToken = await tokenService.CreateAccessTokenAsync(user);
            var refreshToken = await tokenService.CreateRefreshTokenAsync(user);

            return Ok(new LoginResponse
            {
                AccessToken = accessToken,
                RefreshToken = refreshToken
            });
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login(LoginRequest request)
        {
            // request.Email is a dual-purpose identifier: looked up as an email if it contains '@', otherwise as a username.
            var user = request.Email.Contains('@')
                ? await userManager.FindByEmailAsync(request.Email)
                : await userManager.FindByNameAsync(request.Email);
            if (user == null)
                return Unauthorized();

            var validPassword = await userManager.CheckPasswordAsync(user, request.Password);
            if (!validPassword)
                return Unauthorized();

            var accessToken = await tokenService.CreateAccessTokenAsync(user);
            var refreshToken = await tokenService.CreateRefreshTokenAsync(user);

            return Ok(new LoginResponse
            {
                AccessToken = accessToken,
                RefreshToken = refreshToken
            });
        }

        [HttpPost("refresh")]
        public async Task<IActionResult> Refresh(RefreshTokenRequest request)
        {
            var (isValid, user) = await tokenService.ValidateRefreshTokenAsync(request.UserId, request.RefreshToken);

            if (!isValid || user == null)
                return Unauthorized();

            var accessToken = await tokenService.CreateAccessTokenAsync(user);
            var refreshToken = await tokenService.CreateRefreshTokenAsync(user);

            return Ok(new LoginResponse
            {
                AccessToken = accessToken,
                RefreshToken = refreshToken
            });
        }

        [HttpPost("external")]
        public async Task<IActionResult> ExternalSignIn(ExternalAuthRequest request)
        {
            string email, providerId;
            string? providerName;

            try
            {
                (email, providerId, providerName) =
                    await externalAuthService.ValidateProviderTokenAsync(request.Provider, request.IdToken);
            }
            catch
            {
                return Unauthorized(new { message = "Invalid provider token." });
            }

            var displayName = request.Name ?? providerName;

            // 1. Check if this provider login is already linked to an account
            var user = await userManager.FindByLoginAsync(request.Provider, providerId);

            if (user == null)
            {
                // 2. Check if an account with this email already exists (link it)
                user = await userManager.FindByEmailAsync(email);

                if (user == null)
                {
                    // 3. Create a brand-new account
                    var userName = await GenerateUniqueUserNameAsync(displayName ?? email);
                    user = new ApplicationUser
                    {
                        UserName = userName,
                        Email = email,
                        EmailConfirmed = true,
                        Subscription = Domain.Enums.SubscriptionType.Free
                    };

                    var createResult = await userManager.CreateAsync(user);
                    if (!createResult.Succeeded)
                        return BadRequest(createResult.Errors);

                    await userManager.AddToRoleAsync(user, "User");
                }

                // Link external provider to the account so future sign-ins skip account lookup
                await userManager.AddLoginAsync(
                    user,
                    new UserLoginInfo(request.Provider, providerId, request.Provider));
            }

            var accessToken = await tokenService.CreateAccessTokenAsync(user);
            var refreshToken = await tokenService.CreateRefreshTokenAsync(user);

            return Ok(new LoginResponse
            {
                AccessToken = accessToken,
                RefreshToken = refreshToken
            });
        }

        /// <summary>
        /// Permanently deletes the authenticated user's account.
        /// </summary>
        /// <remarks>
        /// Hard-delete: removes the ApplicationUser record. ASP.NET Identity
        /// cascade-deletes related rows (UserRoles, UserTokens including the
        /// refresh-token storage, UserLogins for external auth providers).
        /// <para>
        /// Bookings and Parties owned by this user on the other services are
        /// NOT cascaded today — they remain orphaned by UserId. This is invisible
        /// to the demo flow (a deleted user can't log in) and acceptable for
        /// the v1 investor cut. Cascading cleanup via RabbitMQ UserDeleted
        /// events is a planned hardening pass — see agent_pipeline_gaps memory.
        /// </para>
        /// </remarks>
        [HttpDelete("account")]
        [Authorize]
        public async Task<IActionResult> DeleteAccount()
        {
            var user = await userManager.GetUserAsync(User);
            if (user == null)
                return Unauthorized();

            var remoteIp = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            var userId = user.Id;
            var emailHash = user.Email is null ? "n/a" : Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(user.Email)))[..16];

            var result = await userManager.DeleteAsync(user);
            if (!result.Succeeded)
            {
                logger.LogWarning(
                    "Account deletion FAILED for userId={UserId} emailHash={EmailHash} ip={RemoteIp} errors={Errors}",
                    userId, emailHash, remoteIp,
                    string.Join("; ", result.Errors.Select(e => e.Description)));

                // Return a generic detail to the client; full error detail is server-side only.
                return Problem(
                    statusCode: StatusCodes.Status500InternalServerError,
                    title: "Could not delete account",
                    detail: "Account deletion failed. Please try again or contact support.");
            }

            logger.LogInformation(
                "Account deletion SUCCEEDED for userId={UserId} emailHash={EmailHash} ip={RemoteIp}",
                userId, emailHash, remoteIp);

            return NoContent();
        }

        private async Task<string> GenerateUniqueUserNameAsync(string displayName)
        {
            var baseName = new string(
                displayName.Split('@')[0]
                    .Where(c => char.IsLetterOrDigit(c) || c == '_')
                    .Take(20)
                    .ToArray());

            if (string.IsNullOrEmpty(baseName)) baseName = "user";

            var candidate = baseName;
            var counter = 1;
            while (await userManager.FindByNameAsync(candidate) != null)
                candidate = $"{baseName}{counter++}";

            return candidate;
        }
    }
}
