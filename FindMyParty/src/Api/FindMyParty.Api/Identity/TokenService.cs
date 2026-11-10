using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using FindMyParty.Api.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace FindMyParty.Api.Identity;

/// <summary>One sign-in on one device. Only a hash of the token is stored.</summary>
public class RefreshToken
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = default!;
    public string TokenHash { get; set; } = default!;
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public ApplicationUser User { get; set; } = default!;
}

public class TokenService(IConfiguration configuration, UserManager<ApplicationUser> userManager, AppDbContext db)
{
    /// <summary>A new access token plus a new refresh token for this device.</summary>
    public async Task<LoginResponse> IssueAsync(ApplicationUser user)
    {
        var now = DateTime.UtcNow;
        var lifetimeDays = configuration.GetSection("Jwt").GetValue("RefreshTokenLifetimeDays", 30);
        var raw = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));

        // Housekeeping: drop this user's dead tokens while we are here.
        await db.RefreshTokens.Where(t => t.UserId == user.Id && (t.ExpiresAt < now || t.RevokedAt < now.AddDays(-1))).ExecuteDeleteAsync();
        db.RefreshTokens.Add(new RefreshToken { Id = Guid.NewGuid(), UserId = user.Id, TokenHash = Hash(raw), CreatedAt = now, ExpiresAt = now.AddDays(lifetimeDays) });
        await db.SaveChangesAsync();

        return new LoginResponse(await CreateAccessTokenAsync(user), raw);
    }

    public async Task<string> CreateAccessTokenAsync(ApplicationUser user)
    {
        var jwt = configuration.GetSection("Jwt");
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id),
            new(JwtRegisteredClaimNames.Email, user.Email!),
            new("userName", user.UserName!),
            new("subscription", user.Subscription.ToString())
        };
        foreach (var role in await userManager.GetRolesAsync(user))
            claims.Add(new Claim(ClaimTypes.Role, role));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["Key"]!));
        var token = new JwtSecurityToken(
            issuer: jwt["Issuer"],
            audience: jwt["Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(jwt.GetValue("AccessTokenLifetimeMinutes", 15)),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    /// <summary>
    /// Exchanges a refresh token for a new pair, or returns null if it is unknown, expired, signed out or already used.
    /// A token works once; other devices keep their own.
    /// </summary>
    public async Task<LoginResponse?> RefreshAsync(string? userId, string refreshToken)
    {
        var hash = Hash(refreshToken);
        var now = DateTime.UtcNow;
        var token = await db.RefreshTokens.AsNoTracking().Where(t => t.TokenHash == hash).Select(t => new { t.Id, t.UserId }).FirstOrDefaultAsync();
        if (token is null || (userId is not null && token.UserId != userId)) return null;

        // Only the request that marks it used gets a new pair, even if two arrive together.
        var used = await db.RefreshTokens
            .Where(t => t.Id == token.Id && t.RevokedAt == null && t.ExpiresAt > now)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now));
        if (used == 0) return null;

        var user = await userManager.FindByIdAsync(token.UserId);
        return user is null ? null : await IssueAsync(user);
    }

    /// <summary>Signs one device out.</summary>
    public Task RevokeAsync(string refreshToken)
    {
        var hash = Hash(refreshToken);
        return db.RefreshTokens.Where(t => t.TokenHash == hash && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, DateTime.UtcNow));
    }

    private static string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
