using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using FindMyParty.Api.Demo;
using FindMyParty.Api.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Messaging;

/// <summary>
/// "Forgot password": a mail with a link that works once, for two hours. Using it sets the password
/// (also on an account made with Apple or Google) and signs every device out.
/// </summary>
public class PasswordResetService(
    AppDbContext db,
    UserManager<ApplicationUser> users,
    IEmailSender mail,
    TimeProvider time,
    ILogger<PasswordResetService> logger)
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromHours(2);
    public const string Subject = "Reset your FindMyParty password";
    /// <summary>Links open at once per account; more requests send nothing, so nobody can flood an inbox.</summary>
    public const int MaxOpenLinks = 3;

    /// <summary>
    /// Sends a reset mail when the address belongs to an account that can have a password. Says nothing either way:
    /// the caller answers the same whether or not the account exists, and a mail that fails is only logged.
    /// </summary>
    public async Task RequestAsync(string? email, Func<string, string> linkFor, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(email)) return;
        var user = await users.FindByEmailAsync(email.Trim());
        if (user?.Email is null) return;
        if (user.Email.EndsWith("@" + DemoSeeder.EmailDomain, StringComparison.OrdinalIgnoreCase)) return;
        if (await users.IsInRoleAsync(user, Roles.Door)) return; // the host resets door logins

        var userId = Guid.Parse(user.Id);
        var now = time.GetUtcNow().UtcDateTime;
        var resets = db.Set<PasswordReset>();
        await resets.Where(r => r.UserId == userId && (r.ExpiresAt <= now || r.UsedAt != null)).ExecuteDeleteAsync(ct);
        if (await resets.CountAsync(r => r.UserId == userId, ct) >= MaxOpenLinks)
        {
            logger.LogInformation("Reset for {UserId} not sent: {Max} links are still open", user.Id, MaxOpenLinks);
            return;
        }

        var token = Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(32));
        resets.Add(new PasswordReset { Id = Guid.NewGuid(), UserId = userId, TokenHash = Hash(token), ExpiresAt = now + Lifetime });
        await db.SaveChangesAsync(ct);

        var link = linkFor(token);
        try
        {
            await mail.SendAsync(user.Email, Subject, Html(link), Text(link), ct);
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            logger.LogError(ex, "Reset mail for {UserId} was not sent", user.Id);
        }
    }

    /// <summary>`400 reset_invalid` for a link that is unknown, used or expired; `400 password_weak` with the reasons.</summary>
    public async Task ResetAsync(string? token, string? newPassword, CancellationToken ct)
    {
        var now = time.GetUtcNow().UtcDateTime;
        var hash = Hash(token ?? "");
        var reset = await db.Set<PasswordReset>().AsNoTracking()
            .FirstOrDefaultAsync(r => r.TokenHash == hash && r.UsedAt == null && r.ExpiresAt > now, ct) ?? throw Invalid();
        var user = await users.FindByIdAsync(reset.UserId.ToString()) ?? throw Invalid();

        // Checked before the link is used up, so a weak password can be tried again with the same link.
        var password = newPassword ?? "";
        var problems = new List<IdentityError>();
        foreach (var validator in users.PasswordValidators)
        {
            var result = await validator.ValidateAsync(users, user, password);
            if (!result.Succeeded) problems.AddRange(result.Errors);
        }
        if (problems.Count > 0) throw Weak(problems);

        await using var tx = await db.Database.BeginTransactionAsync(ct);

        // Only one request gets to use a link, even if two arrive together. Every other open link of this account dies too.
        var claimed = await db.Set<PasswordReset>().Where(r => r.Id == reset.Id && r.UsedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.UsedAt, now), ct);
        if (claimed == 0) throw Invalid();
        await db.Set<PasswordReset>().Where(r => r.UserId == reset.UserId && r.UsedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.UsedAt, now), ct);

        if (await users.HasPasswordAsync(user)) Check(await users.RemovePasswordAsync(user));
        Check(await users.AddPasswordAsync(user, password));
        // Whoever forgot their password may also have locked the account guessing it.
        Check(await users.SetLockoutEndDateAsync(user, null));
        Check(await users.ResetAccessFailedCountAsync(user));

        await db.RefreshTokens.Where(t => t.UserId == user.Id && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), ct);

        await tx.CommitAsync(ct);
        logger.LogInformation("Password reset for {UserId}", user.Id);
    }

    private static void Check(IdentityResult result)
    {
        if (!result.Succeeded) throw Weak(result.Errors);
    }

    private static ApiException Invalid() =>
        ApiException.Invalid("That reset link has expired. Ask for a new one.", "reset_invalid");

    private static ApiException Weak(IEnumerable<IdentityError> errors) =>
        ApiException.Invalid("At least 8 characters, with a letter and a digit.", "password_weak")
            .With("errors", errors.Select(e => new { code = e.Code, description = e.Description }).ToList());

    private static string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    private static string Text(string link) => $"""
        Someone asked to reset the password of your FindMyParty account.

        Choose a new password here. The link works once, for two hours:
        {link}

        If it was not you, ignore this mail. Your password stays as it is.
        """;

    private static string Html(string link)
    {
        var href = HtmlEncoder.Default.Encode(link);
        return $"""
            <!doctype html>
            <html lang="en">
            <body style="margin:0;padding:32px 16px;background:#07060d;color:#f4f2fa;font:16px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
            <div style="max-width:28rem;margin:0 auto">
            <h1 style="font-size:22px;margin:0 0 12px">Reset your password</h1>
            <p style="margin:0 0 24px;color:#a9a4bd">Someone asked to reset the password of your FindMyParty account. The link works once, for two hours.</p>
            <p style="margin:0 0 24px"><a href="{href}" style="display:inline-block;background:#f4f2fa;color:#07060d;text-decoration:none;font-weight:600;padding:12px 18px;border-radius:12px">Choose a new password</a></p>
            <p style="margin:0 0 8px;color:#a9a4bd;font-size:13px">Or open this address: <a href="{href}" style="color:#f4f2fa">{href}</a></p>
            <p style="margin:0;color:#a9a4bd;font-size:13px">If it was not you, ignore this mail. Your password stays as it is.</p>
            </div>
            </body>
            </html>
            """;
    }
}
