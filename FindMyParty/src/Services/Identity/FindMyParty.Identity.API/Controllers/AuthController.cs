using FindMyParty.Identity.API.Application.DTOs;
using FindMyParty.Identity.API.Application.Services;
using FindMyParty.Identity.API.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace FindMyParty.Identity.API.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController(UserManager<ApplicationUser> userManager, ITokenService tokenService) : ControllerBase
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
    }
}
