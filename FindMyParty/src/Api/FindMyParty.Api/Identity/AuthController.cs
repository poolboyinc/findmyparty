using FindMyParty.Api.Bookings;
using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using FindMyParty.Api.Parties;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace FindMyParty.Api.Identity;

[ApiController]
[Route("api/auth")]
[EnableRateLimiting("auth")]
public class AuthController(
    UserManager<ApplicationUser> userManager,
    TokenService tokens,
    IExternalAuthService externalAuth,
    AppDbContext db,
    IEnumerable<IAccountCleanup> cleanups,
    ILogger<AuthController> logger) : ControllerBase
{
    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        var user = new ApplicationUser { UserName = request.UserName, Email = request.Email };
        var result = await userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded) return BadRequest(result.Errors);

        await userManager.AddToRoleAsync(user, Roles.User);
        return Ok(await tokens.IssueAsync(user));
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        // `Email` doubles as a username: looked up by email if it contains '@'.
        var user = request.Email.Contains('@')
            ? await userManager.FindByEmailAsync(request.Email)
            : await userManager.FindByNameAsync(request.Email);
        if (user == null) return Unauthorized();

        if (await userManager.IsLockedOutAsync(user))
        {
            // A ban locks the account for good (Friends/ReportService); wrong passwords lock it for minutes.
            if (user.LockoutEnd is { } end && end > DateTimeOffset.UtcNow.AddYears(10))
                throw new ApiException(StatusCodes.Status403Forbidden, "This account has been closed.", "account_closed");
            throw new ApiException(StatusCodes.Status429TooManyRequests, "Too many wrong passwords. Try again in a few minutes.", "locked_out");
        }
        if (!await userManager.CheckPasswordAsync(user, request.Password))
        {
            await userManager.AccessFailedAsync(user); // counts towards the lockout
            return Unauthorized();
        }
        await userManager.ResetAccessFailedCountAsync(user);

        return Ok(await tokens.IssueAsync(user));
    }

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh(RefreshTokenRequest request)
    {
        var pair = await tokens.RefreshAsync(request.UserId, request.RefreshToken);
        return pair is null ? Unauthorized() : Ok(pair);
    }

    /// <summary>Signs this device out. Other devices stay signed in.</summary>
    [HttpPost("logout")]
    public async Task<IActionResult> Logout(LogoutRequest request)
    {
        await tokens.RevokeAsync(request.RefreshToken);
        return NoContent();
    }

    [HttpPost("external")]
    public async Task<IActionResult> ExternalSignIn(ExternalAuthRequest request)
    {
        ExternalIdentity identity;
        try
        {
            identity = await externalAuth.ValidateAsync(request.Provider, request.IdToken);
        }
        catch
        {
            return Unauthorized(new { message = "Invalid provider token." });
        }
        if (!identity.EmailVerified)
            return Unauthorized(new { message = "This email is not verified with the provider." });

        var user = await userManager.FindByLoginAsync(request.Provider, identity.ProviderId);
        if (user == null)
        {
            user = await userManager.FindByEmailAsync(identity.Email);
            // An account made with just a password never proved it owns this address, so it could have been
            // created by someone else. Do not attach the real owner's Google or Apple sign-in to it.
            if (user is { EmailConfirmed: false })
                throw ApiException.Conflict("An account with this email already exists. Log in with your password.", "account_exists");
            if (user == null)
            {
                user = new ApplicationUser
                {
                    UserName = await GenerateUniqueUserNameAsync(request.Name ?? identity.Name ?? identity.Email),
                    Email = identity.Email,
                    EmailConfirmed = true
                };
                var created = await userManager.CreateAsync(user);
                if (!created.Succeeded) return BadRequest(created.Errors);
                await userManager.AddToRoleAsync(user, Roles.User);
            }
            await userManager.AddLoginAsync(user, new UserLoginInfo(request.Provider, identity.ProviderId, request.Provider));
        }

        return Ok(await tokens.IssueAsync(user));
    }

    /// <summary>
    /// Permanently deletes the signed-in user's account and what hangs off it: their bookings (spots go back),
    /// and for a host their venue and parties (cancelled, with the bookings on them). Each feature removes
    /// its own rows through an IAccountCleanup, in the same transaction: either everything goes or nothing does.
    /// </summary>
    [HttpDelete("account")]
    [Authorize]
    public async Task<IActionResult> DeleteAccount()
    {
        var user = await userManager.GetUserAsync(User);
        if (user == null) return Unauthorized();
        var userId = Guid.Parse(user.Id);

        await using var tx = await db.Database.BeginTransactionAsync();

        // As a guest: give held spots back, then remove the bookings.
        var held = await db.Bookings
            .Where(b => b.UserId == userId && b.Status != BookingStatus.Cancelled && b.Status != BookingStatus.Expired)
            .GroupBy(b => b.PartyId)
            .Select(g => new { PartyId = g.Key, Tickets = g.Sum(b => b.TicketCount) })
            .ToListAsync();
        foreach (var h in held)
            await db.Parties.Where(p => p.Id == h.PartyId)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.TicketsSold, p => p.TicketsSold >= h.Tickets ? p.TicketsSold - h.Tickets : 0));
        await db.Bookings.Where(b => b.UserId == userId).ExecuteDeleteAsync();

        // As a host: cancel their parties and the bookings on them. Rows stay so guests still see "cancelled".
        var partyIds = await db.Parties.Where(p => p.HostId == userId && !p.IsDeleted).Select(p => p.Id).ToListAsync();
        if (partyIds.Count > 0)
        {
            await db.Bookings.Where(b => partyIds.Contains(b.PartyId) && b.Status != BookingStatus.Cancelled)
                .ExecuteUpdateAsync(s => s.SetProperty(b => b.Status, BookingStatus.Cancelled));
            await db.Parties.Where(p => partyIds.Contains(p.Id))
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.Status, PartyStatus.Cancelled).SetProperty(p => p.TicketsSold, 0));
        }

        // What other features keep about this account. One that fails stops the whole deletion.
        foreach (var cleanup in cleanups)
            await cleanup.DeleteAsync(userId, HttpContext.RequestAborted);

        // The user row takes roles, external logins, refresh tokens and the venue profile with it.
        var result = await userManager.DeleteAsync(user);
        if (!result.Succeeded)
        {
            logger.LogWarning("Account deletion failed for {UserId}: {Errors}", user.Id, string.Join("; ", result.Errors.Select(e => e.Description)));
            return Problem(statusCode: StatusCodes.Status500InternalServerError, title: "Could not delete account");
        }
        await tx.CommitAsync();

        logger.LogInformation("Account deleted for {UserId}", user.Id);
        return NoContent();
    }

    /// <summary>
    /// "Mila Perić" → "MilaPeric": user names keep to letters and digits Identity accepts. Accents come off
    /// (ć → c, š → s, ž → z); the letters that are not a base letter with an accent are spelled out.
    /// </summary>
    public static string Ascii(string text)
    {
        var spelled = text.Replace("đ", "dj").Replace("Đ", "Dj").Replace("ß", "ss").Replace("ø", "o").Replace("Ø", "O")
            .Replace("ł", "l").Replace("Ł", "L").Replace("æ", "ae").Replace("Æ", "Ae");
        var decomposed = spelled.Normalize(System.Text.NormalizationForm.FormD);
        return new string(decomposed.Where(c => System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c)
            != System.Globalization.UnicodeCategory.NonSpacingMark).ToArray());
    }

    private async Task<string> GenerateUniqueUserNameAsync(string displayName)
    {
        var baseName = new string(Ascii(displayName.Split('@')[0]).Where(c => char.IsAsciiLetterOrDigit(c) || c == '_').Take(20).ToArray());
        if (string.IsNullOrEmpty(baseName)) baseName = "user";

        var candidate = baseName;
        var counter = 1;
        while (await userManager.FindByNameAsync(candidate) != null)
            candidate = $"{baseName}{counter++}";
        return candidate;
    }
}
