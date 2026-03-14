using FindMyParty.Identity.API.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace FindMyParty.Identity.API.Application.Services
{
    public class TokenService(IConfiguration configuration, UserManager<ApplicationUser> userManager) : ITokenService
    {
        private const string LoginProvider = "FindMyParty";
        private const string RefreshTokenName = "RefreshToken";
        private const string RefreshTokenExpiryName = "RefreshTokenExpiry";

        public async Task<string> CreateAccessTokenAsync(ApplicationUser user)
        {
            var jwtSettings = configuration.GetSection("Jwt");

            var claims = new List<Claim>
            {
                new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new(JwtRegisteredClaimNames.Email, user.Email!),
                new("userName", user.UserName!),
                new("subscription", user.Subscription.ToString())
            };

            var roles = await userManager.GetRolesAsync(user);
            foreach (var role in roles)
                claims.Add(new Claim(ClaimTypes.Role, role));

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings["Key"]!));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: jwtSettings["Issuer"],
                audience: jwtSettings["Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(int.Parse(jwtSettings["AccessTokenLifetimeMinutes"]!)),
                signingCredentials: creds);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        public async Task<string> CreateRefreshTokenAsync(ApplicationUser user)
        {
            var jwtSettings = configuration.GetSection("Jwt");
            var lifetimeDays = int.Parse(jwtSettings["RefreshTokenLifetimeDays"]!);

            var tokenBytes = RandomNumberGenerator.GetBytes(64);
            var refreshToken = Convert.ToBase64String(tokenBytes);
            var expiry = DateTime.UtcNow.AddDays(lifetimeDays).ToString("O");

            await userManager.SetAuthenticationTokenAsync(user, LoginProvider, RefreshTokenName, refreshToken);
            await userManager.SetAuthenticationTokenAsync(user, LoginProvider, RefreshTokenExpiryName, expiry);

            return refreshToken;
        }

        public async Task<(bool isValid, ApplicationUser? user)> ValidateRefreshTokenAsync(string userId, string refreshToken)
        {
            var user = await userManager.FindByIdAsync(userId);
            if (user == null)
                return (false, null);

            var storedToken = await userManager.GetAuthenticationTokenAsync(user, LoginProvider, RefreshTokenName);
            var storedExpiry = await userManager.GetAuthenticationTokenAsync(user, LoginProvider, RefreshTokenExpiryName);

            if (storedToken == null || storedExpiry == null)
                return (false, null);

            if (!CryptographicOperations.FixedTimeEquals(
                    Encoding.UTF8.GetBytes(storedToken),
                    Encoding.UTF8.GetBytes(refreshToken)))
                return (false, null);

            if (!DateTime.TryParse(storedExpiry, out var expiry) || DateTime.UtcNow > expiry)
                return (false, null);

            return (true, user);
        }
    }
}
