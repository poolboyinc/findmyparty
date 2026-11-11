using FindMyParty.Api.Cities;
using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Glow;

/// <summary>
/// "Your night" (push `recap_ready`, category Nights): at 12:00 local the day after a night with a scan, once per night.
/// Runs every quarter-hour; not started in environment Testing (tests call RunOnceAsync). Safe with several copies
/// running: a night is marked sent before its push goes, and only one copy can mark it.
/// </summary>
public class RecapPusher(IServiceScopeFactory scopes, TimeProvider time, IHostEnvironment environment, ILogger<RecapPusher> logger) : BackgroundService
{
    /// <summary>The local hour, the day after, when the recap is ready.</summary>
    public const int ReadyAtHour = 12;
    /// <summary>Nights older than this are never announced (a server that was down does not send old news).</summary>
    private const int LookBackDays = 3;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (environment.IsEnvironment("Testing")) return;
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(15), time);
        do
        {
            try
            {
                await RunOnceAsync(stoppingToken);
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                logger.LogError(e, "Sending night recaps failed; will try again in 15 minutes");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    /// <summary>Sends every recap that is due and not sent yet. Returns how many went out.</summary>
    public async Task<int> RunOnceAsync(CancellationToken ct = default)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var notifier = scope.ServiceProvider.GetRequiredService<INotifier>();
        var now = time.GetUtcNow().UtcDateTime;
        var since = DateOnly.FromDateTime(now).AddDays(-LookBackDays);

        var scans = await (
            from e in db.Set<GlowEntry>()
            where GlowKinds.ScanParts.Contains(e.Kind) && e.NightDate >= since
            where !db.Set<RecapNotice>().Any(n => n.UserId == e.UserId && n.NightDate == e.NightDate)
            join v in db.VenueProfiles on e.VenueId equals (Guid?)v.Id into venues
            from v in venues.DefaultIfEmpty()
            select new { e.UserId, e.NightDate, e.Kind, e.Points, e.VenueId, e.At, CitySlug = (string?)v.CitySlug })
            .AsNoTracking().ToListAsync(ct);

        var sent = 0;
        foreach (var night in scans.GroupBy(s => (s.UserId, s.NightDate)))
        {
            var first = night.Where(s => s.Kind == GlowKinds.Scan).OrderBy(s => s.At).FirstOrDefault();
            if (first is null) continue;
            var city = first.CitySlug ?? City.Default;
            var readyAt = CityClock.Utc(night.Key.NightDate.AddDays(1).ToDateTime(new TimeOnly(ReadyAtHour, 0)), city);
            if (now < readyAt) continue;

            // Marks the night; a copy that got there first wins and this one moves on.
            var marked = await db.Database.ExecuteSqlInterpolatedAsync(
                $"""INSERT INTO "RecapNotices" ("UserId", "NightDate", "SentAt") VALUES ({night.Key.UserId}, {night.Key.NightDate}, {now}) ON CONFLICT DO NOTHING""", ct);
            if (marked == 0) continue;

            var venues = night.Where(s => s.Kind == GlowKinds.Scan).Select(s => s.VenueId).Distinct().Count();
            var glow = night.Sum(s => s.Points);
            await notifier.SendAsync(new Push([night.Key.UserId], "recap_ready", "Your night",
                $"{GlowRules.VenueCount(venues)}, +{GlowRules.Points(glow)} Glow",
                new RecapPushData(night.Key.NightDate), NotifyCategory.Nights), ct);
            sent++;
        }
        return sent;
    }
}
