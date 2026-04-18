using FindMyParty.Identity.API.Application.DTOs;
using FindMyParty.Identity.API.Application.Services;
using FindMyParty.Identity.API.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace FindMyParty.Identity.API.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController(
        UserManager<ApplicationUser> userManager,
        ITokenService tokenService,
        IExternalAuthService externalAuthService) : ControllerBase
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
            var user = await userManager.FindByEmailAsync(request.Email);
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
            var (isValid, user) = await tokenService.ValidateRefreshTokenAsync(request.RefreshToken);

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
