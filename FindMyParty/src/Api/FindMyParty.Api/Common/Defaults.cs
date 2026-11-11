using FindMyParty.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Common;

/// <summary>Push is not set up: nothing is sent.</summary>
public class NullNotifier : INotifier
{
    public Task SendAsync(Push push, CancellationToken ct = default) => Task.CompletedTask;
}

/// <summary>Mail is not set up: says what would have gone out, and shows the text while developing.</summary>
public class LogEmailSender(ILogger<LogEmailSender> logger, IHostEnvironment environment) : IEmailSender
{
    public Task SendAsync(string to, string subject, string html, string text, CancellationToken ct = default)
    {
        logger.LogInformation("would send '{Subject}' to {Address}", subject, to);
        if (environment.IsDevelopment()) logger.LogInformation("{Text}", text);
        return Task.CompletedTask;
    }
}

/// <summary>Only the venue's host may work its door, as "Host".</summary>
public class HostOnlyVenueAccess(AppDbContext db) : IVenueAccess
{
    public const string HostDoorName = "Host";

    public async Task<string?> DoorNameAsync(Guid userId, Guid venueId, CancellationToken ct)
    {
        var id = userId.ToString();
        return await db.VenueProfiles.AnyAsync(v => v.Id == venueId && v.UserId == id, ct) ? HostDoorName : null;
    }
}
