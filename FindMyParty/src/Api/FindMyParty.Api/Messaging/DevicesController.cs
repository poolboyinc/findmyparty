using System.Text.RegularExpressions;
using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Messaging;

public record RegisterDeviceRequest(string? ExpoPushToken, string? Platform);

/// <summary>The phones that get this account's pushes.</summary>
[ApiController]
[Authorize]
[Route("api/me/devices")]
public partial class DevicesController(AppDbContext db, TimeProvider time) : ControllerBase
{
    [GeneratedRegex(@"^Expo(nent)?PushToken\[[^\[\]\s]{1,180}\]$")]
    private static partial Regex ExpoToken();

    /// <summary>Registers this phone, or says it is still here. A token moves to whoever registers it last.</summary>
    [HttpPut]
    public async Task<IActionResult> Register(RegisterDeviceRequest request, CancellationToken ct)
    {
        var token = request.ExpoPushToken?.Trim() ?? "";
        if (!ExpoToken().IsMatch(token)) throw ApiException.Invalid("That is not an Expo push token.");
        var platform = request.Platform?.Trim().ToLowerInvariant();
        if (platform is not ("ios" or "android")) throw ApiException.Invalid("Platform is ios or android.");

        var userId = User.UserId();
        var now = time.GetUtcNow().UtcDateTime;
        // One statement, so two phones (or two users) registering at once cannot make a second row.
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "PushDevices" ("Id", "UserId", "ExpoToken", "Platform", "CreatedAt", "LastSeenAt")
            VALUES ({Guid.NewGuid()}, {userId}, {token}, {platform}, {now}, {now})
            ON CONFLICT ("ExpoToken") DO UPDATE
            SET "UserId" = excluded."UserId", "Platform" = excluded."Platform", "LastSeenAt" = excluded."LastSeenAt"
            """, ct);
        return NoContent();
    }

    /// <summary>Stops pushes to this phone (on sign-out). Only your own device; an unknown token is fine.</summary>
    [HttpDelete("{expoPushToken}")]
    public async Task<IActionResult> Remove(string expoPushToken, CancellationToken ct)
    {
        var userId = User.UserId();
        await db.Set<PushDevice>().Where(d => d.ExpoToken == expoPushToken && d.UserId == userId).ExecuteDeleteAsync(ct);
        return NoContent();
    }
}
