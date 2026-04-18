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

            // Format: "{userId}.{base64(randomBytes)}"
            // The userId prefix is not a secret (it's also in the access token) but lets
            // the server identify the account without trusting a client-sent userId.
            var tokenBytes = RandomNumberGenerator.GetBytes(64);
            var secret = Convert.ToBase64String(tokenBytes);
            var refreshToken = $"{user.Id}.{secret}";
            var expiry = DateTime.UtcNow.AddDays(lifetimeDays).ToString("O");

            await userManager.SetAuthenticationTokenAsync(user, LoginProvider, RefreshTokenName, refreshToken);
            await userManager.SetAuthenticationTokenAsync(user, LoginProvider, RefreshTokenExpiryName, expiry);

            return refreshToken;
        }

        public async Task<(bool isValid, ApplicationUser? user)> ValidateRefreshTokenAsync(string refreshToken)
        {
            if (string.IsNullOrEmpty(refreshToken))
                return (false, null);

            // Parse the userId prefix out of the refresh token itself.
            var dotIndex = refreshToken.IndexOf('.');
            if (dotIndex <= 0 || dotIndex == refreshToken.Length - 1)
                return (false, null);

            var userId = refreshToken.Substring(0, dotIndex);

            var user = await userManager.FindByIdAsync(userId);
            if (user == null)
                return (false, null);

            var storedToken = await userManager.GetAuthenticationTokenAsync(user, LoginProvider, RefreshTokenName);
            var storedExpiry = await userManager.GetAuthenticationTokenAsync(user, LoginProvider, RefreshTokenExpiryName);

            if (storedToken == null || storedExpiry == null)
                return (false, null);

            // Constant-time compare to avoid timing attacks. Length difference => fail fast but constant per length.
            var storedBytes = Encoding.UTF8.GetBytes(storedToken);
            var givenBytes = Encoding.UTF8.GetBytes(refreshToken);
            if (storedBytes.Length != givenBytes.Length)
                return (false, null);
            if (!CryptographicOperations.FixedTimeEquals(storedBytes, givenBytes))
                return (false, null);

            if (!DateTime.TryParse(storedExpiry, out var expiry) || DateTime.UtcNow > expiry)
                return (false, null);

            return (true, user);
        }
    }
}
