using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using FindMyParty.Api.Parties;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace FindMyParty.Api.Venues;

/// <summary>
/// "Tonight by hour" (S-11) for tonight's running or next party at a venue: eight hours from two hours before the
/// party's start hour. A bar is the number of guests let in during the three hours up to it, shown as a share of the
/// tallest bar. Hours gone by are what happened, the current hour is now, later hours are what usually happens on this
/// weekday (the mean of the last six weeks that had scans; left out with no such history).
/// </summary>
public class VenueTonightService(AppDbContext db, TimeProvider time, IMemoryCache cache)
{
    public const int Hours = 8;
    public const int HoursBeforeStart = 2;
    public const int HistoryWeeks = 6;
    private static readonly TimeSpan Window = TimeSpan.FromHours(3);
    private static readonly TimeSpan CacheFor = TimeSpan.FromMinutes(5);

    public async Task<VenueTonight?> ForAsync(Guid venueId, string citySlug, CancellationToken ct = default)
    {
        var now = time.GetUtcNow().UtcDateTime;
        // The hour is in the key, so a moved clock (or a new hour) never reads the last hour's bars.
        var key = $"venue-tonight:{venueId}:{now:yyyyMMddHH}";
        if (cache.TryGetValue(key, out VenueTonight? cached)) return cached;

        var tonight = await ComputeAsync(venueId, citySlug, now, ct);
        cache.Set(key, tonight, new MemoryCacheEntryOptions { AbsoluteExpirationRelativeToNow = CacheFor, Size = 1 });
        return tonight;
    }

    private async Task<VenueTonight?> ComputeAsync(Guid venueId, string city, DateTime now, CancellationToken ct)
    {
        var parties = await db.Parties.AsNoTracking()
            .Where(p => p.VenueId == venueId && p.Status == PartyStatus.Published && !p.IsDeleted && p.EndsAt > now)
            .OrderBy(p => p.StartsAt)
            .Select(p => new { p.Id, p.StartsAt })
            .Take(10)
            .ToListAsync(ct);
        var night = CityClock.NightDate(now, city);
        var party = parties.FirstOrDefault(p => p.StartsAt <= now) ?? parties.FirstOrDefault(p => CityClock.NightDate(p.StartsAt, city) == night);
        if (party is null) return null;

        // The eight hours, on the city's wall clock, and the same hours on the same weekday of earlier weeks.
        var start = CityClock.Local(party.StartsAt, city);
        var first = new DateTime(start.Year, start.Month, start.Day, start.Hour, 0, 0).AddHours(-HoursBeforeStart);
        DateTime HourUtc(int i, int weeksBack = 0) => CityClock.Utc(first.AddHours(i).AddDays(-7 * weeksBack), city);

        var since = HourUtc(0, HistoryWeeks) - Window;
        var scans = await (
            from c in db.CheckIns
            join p in db.Parties on c.PartyId equals p.Id
            where p.VenueId == venueId && c.At > since && c.At <= now
            select new { c.At, c.Admitted, c.PartyId }).AsNoTracking().ToListAsync(ct);
        int Admitted(DateTime after, DateTime upTo) => scans.Where(s => s.At > after && s.At <= upTo).Sum(s => s.Admitted);

        var partyNight = CityClock.NightDate(party.StartsAt, city);
        var weeks = Enumerable.Range(1, HistoryWeeks)
            .Where(k => scans.Any(s => CityClock.NightDate(s.At, city) == partyNight.AddDays(-7 * k)))
            .ToList();
        var usual = Enumerable.Range(0, Hours)
            .Select(i => weeks.Count == 0 ? 0 : weeks.Average(k => (double)Admitted(HourUtc(i + 1, k) - Window, HourUtc(i + 1, k))))
            .ToList();

        var bars = new List<(DateTime At, double Value, string Kind)>();
        for (var i = 0; i < Hours; i++)
        {
            DateTime at = HourUtc(i), end = HourUtc(i + 1);
            if (end <= now) bars.Add((at, Admitted(end - Window, end), "past"));
            else if (at <= now) bars.Add((at, Admitted(now - Window, now), "now"));
            else if (weeks.Count > 0) bars.Add((at, usual[i], "usual"));
        }
        var tallest = bars.Count == 0 ? 0 : bars.Max(b => b.Value);
        var hours = bars.Select(b => new VenueHour(b.At, tallest > 0 ? Math.Round(b.Value / tallest, 2, MidpointRounding.AwayFromZero) : 0, b.Kind)).ToList();

        DateTime? peak = null;
        if (weeks.Count > 0 && usual.Max() > 0) peak = HourUtc(usual.IndexOf(usual.Max()));

        return new VenueTonight(hours, Trend(scans.Any(s => s.PartyId == party.Id), Admitted(now.AddHours(-1), now), Admitted(now.AddHours(-2), now.AddHours(-1))), peak);
    }

    /// <summary>Arrivals in the last hour against the hour before: more than 1.2× is filling, under 0.8× thinning.</summary>
    private static string? Trend(bool anyScans, int lastHour, int hourBefore)
    {
        if (!anyScans) return null;
        if (hourBefore == 0) return lastHour > 0 ? "filling" : "steady";
        var ratio = (double)lastHour / hourBefore;
        return ratio > 1.2 ? "filling" : ratio < 0.8 ? "thinning" : "steady";
    }
}
