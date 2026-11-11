using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Bookings;

/// <summary>
/// Every minute: reminds bookers 30 minutes before their hold ends, and gives back the spots of bookings nobody was
/// scanned in on. Not started in environment Testing (tests call RunOnceAsync). Safe with several copies running:
/// every change is claimed by a conditional update, so only one copy acts on a booking.
/// </summary>
public class HoldSweeper(IServiceScopeFactory scopes, IHostEnvironment environment, ILogger<HoldSweeper> logger) : BackgroundService
{
    public static readonly TimeSpan ReminderBefore = TimeSpan.FromMinutes(30);
    private const int Batch = 100;

    public record Sweep(int Reminded, int Expired);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (environment.IsEnvironment("Testing")) return;
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await RunOnceAsync(stoppingToken);
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                logger.LogError(e, "Hold sweep failed; trying again in a minute");
            }
        }
    }

    public async Task<Sweep> RunOnceAsync(CancellationToken ct = default)
    {
        await using var scope = scopes.CreateAsyncScope();
        var services = scope.ServiceProvider;
        var db = services.GetRequiredService<AppDbContext>();
        var now = services.GetRequiredService<TimeProvider>().GetUtcNow().UtcDateTime;
        var reminded = await RemindAsync(db, services.GetRequiredService<INotifier>(), now, ct);
        // A door that lost its signal may still replay a scan made before the hold ended, so the spots wait that long more.
        var grace = TimeSpan.FromMinutes(services.GetRequiredService<IConfiguration>().GetValue("Door:OfflineWindowMinutes", 15));
        var expired = await ExpireAsync(db, now, now - grace, ct);
        return new Sweep(reminded, expired);
    }

    /// <summary>Push `hold_ending`, once per booking, from 30 minutes before the hold ends.</summary>
    private static async Task<int> RemindAsync(AppDbContext db, INotifier notifier, DateTime now, CancellationToken ct)
    {
        var due = await (
            from b in db.Bookings
            where b.Status == BookingStatus.Pending && b.CheckedInCount == 0 && b.HoldReminderSentAt == null
                  && b.HeldUntil > now && b.HeldUntil <= now + ReminderBefore
            join p in db.Parties on b.PartyId equals p.Id
            join v in db.VenueProfiles on p.VenueId equals (Guid?)v.Id into venues
            from v in venues.DefaultIfEmpty()
            select new { b.Id, b.UserId, b.HeldUntil, p.Title, VenueName = (string?)v.VenueName, CitySlug = (string?)v.CitySlug })
            .AsNoTracking().Take(Batch).ToListAsync(ct);

        var sent = 0;
        foreach (var d in due)
        {
            var claimed = await db.Bookings.Where(b => b.Id == d.Id && b.HoldReminderSentAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(b => b.HoldReminderSentAt, now), ct);
            if (claimed == 0) continue; // another copy sent it
            var local = CityClock.Local(d.HeldUntil, d.CitySlug);
            await notifier.SendAsync(new Push([d.UserId], "hold_ending", $"Your spot at {d.VenueName ?? d.Title}",
                $"Held until {local:HH:mm}. Show your pass at the door.", new { bookingId = d.Id }), ct);
            sent++;
        }
        return sent;
    }

    /// <summary>Bookings still pending with nobody in and the hold over become Expired: spots back, guest passes revoked. One transaction per batch.</summary>
    private static async Task<int> ExpireAsync(AppDbContext db, DateTime now, DateTime cutoff, CancellationToken ct)
    {
        var total = 0;
        while (true)
        {
            var batch = await db.Bookings.AsNoTracking()
                .Where(b => b.Status == BookingStatus.Pending && b.CheckedInCount == 0 && b.HeldUntil < cutoff)
                .OrderBy(b => b.Id).Take(Batch)
                .Select(b => new { b.Id, b.PartyId, b.TicketCount }).ToListAsync(ct);
            if (batch.Count == 0) return total;

            var expired = 0;
            await using (var tx = await db.Database.BeginTransactionAsync(ct))
            {
                foreach (var b in batch)
                {
                    // Re-checked by the database: a scan or a cancel that got there first wins.
                    var changed = await db.Bookings
                        .Where(x => x.Id == b.Id && x.Status == BookingStatus.Pending && x.CheckedInCount == 0 && x.HeldUntil < cutoff)
                        .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, BookingStatus.Expired), ct);
                    if (changed == 0) continue;
                    await BookingService.ReleaseAsync(db, b.PartyId, b.TicketCount, ct);
                    await BookingService.RevokeGuestPassesAsync(db, b.Id, now, ct);
                    expired++;
                }
                await tx.CommitAsync(ct);
            }
            total += expired;
            if (batch.Count < Batch) return total;
        }
    }
}
