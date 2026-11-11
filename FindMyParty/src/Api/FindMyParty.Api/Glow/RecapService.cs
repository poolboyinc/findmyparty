using System.Security.Cryptography;
using FindMyParty.Api.Cities;
using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Glow;

/// <summary>A night out after the fact (S-16): the venues in order, how long, how much Glow, and the share link.</summary>
public class RecapService(AppDbContext db)
{
    private DbSet<RecapShare> Shares => db.Set<RecapShare>();

    /// <summary>The guest's nights, newest first.</summary>
    public async Task<List<NightSummary>> NightsAsync(Guid userId, int take, CancellationToken ct)
    {
        take = Math.Clamp(take, 1, 100);
        var entries = await db.Set<GlowEntry>()
            .Where(x => x.UserId == userId && GlowKinds.ScanParts.Contains(x.Kind))
            .Select(x => new { x.NightDate, x.Kind, x.Points, x.VenueId, x.At })
            .AsNoTracking().ToListAsync(ct);
        var nights = entries.GroupBy(x => x.NightDate).OrderByDescending(g => g.Key).Take(take).ToList();

        var firstVenues = nights.Select(n => n.Where(x => x.Kind == GlowKinds.Scan).OrderBy(x => x.At).First().VenueId)
            .Where(v => v is not null).Select(v => v!.Value).Distinct().ToList();
        var cities = await db.VenueProfiles.Where(v => firstVenues.Contains(v.Id)).ToDictionaryAsync(v => v.Id, v => v.CitySlug, ct);

        return nights.Select(n =>
        {
            var scans = n.Where(x => x.Kind == GlowKinds.Scan).OrderBy(x => x.At).ToList();
            var city = scans[0].VenueId is { } v ? cities.GetValueOrDefault(v) : null;
            return new NightSummary(n.Key, CityName(city), scans.Select(s => s.VenueId).Distinct().Count(), n.Sum(x => x.Points));
        }).ToList();
    }

    private static string CityName(string? slug) =>
        (City.All.FirstOrDefault(c => c.Slug == slug) ?? City.All.First(c => c.Slug == City.Default)).Name;

    /// <summary>One night's recap, or null when the guest was not scanned in anywhere that night.</summary>
    public async Task<NightRecap?> RecapAsync(Guid userId, DateOnly night, string? shareUrl, CancellationToken ct)
    {
        var entries = await db.Set<GlowEntry>()
            .Where(x => x.UserId == userId && x.NightDate == night && GlowKinds.ScanParts.Contains(x.Kind))
            .AsNoTracking().ToListAsync(ct);
        var scans = entries.Where(x => x.Kind == GlowKinds.Scan).OrderBy(x => x.At).ToList();
        if (scans.Count == 0) return null;

        var venueIds = scans.Where(s => s.VenueId is not null).Select(s => s.VenueId!.Value).Distinct().ToList();
        var venues = await db.VenueProfiles.Where(v => venueIds.Contains(v.Id))
            .Select(v => new { v.Id, v.VenueName, v.Latitude, v.Longitude, v.CitySlug }).AsNoTracking().ToDictionaryAsync(v => v.Id, ct);
        var partyIds = scans.Where(s => s.PartyId is not null).Select(s => s.PartyId!.Value).Distinct().ToList();
        var parties = await db.Parties.Where(p => partyIds.Contains(p.Id))
            .Select(p => new { p.Id, p.EndsAt, p.Genre }).AsNoTracking().ToDictionaryAsync(p => p.Id, ct);

        var city = scans[0].VenueId is { } first && venues.TryGetValue(first, out var firstVenue) ? firstVenue.CitySlug : City.Default;

        // From the first scan to the end of the last party scanned into, never past 06:00 the morning after.
        var start = scans[0].At;
        var lastParty = scans[^1].PartyId is { } lastId && parties.TryGetValue(lastId, out var p) ? p.EndsAt : start;
        var nightEnds = CityClock.Utc(night.AddDays(1).ToDateTime(new TimeOnly(CityClock.NightEndsAtHour, 0)), city);
        var end = lastParty < nightEnds ? lastParty : nightEnds;
        var minutesOut = Math.Max(0, (int)(end - start).TotalMinutes);

        // The genre of most of the night's parties; on a tie, the one visited first.
        var genres = scans.Where(s => s.PartyId is not null).Select(s => s.PartyId!.Value).Distinct()
            .Select(id => parties.TryGetValue(id, out var party) ? party.Genre : null)
            .Where(g => !string.IsNullOrWhiteSpace(g)).Select(g => g!).ToList();
        var mostly = genres.Select((g, i) => (g, i)).GroupBy(x => x.g)
            .OrderByDescending(g => g.Count()).ThenBy(g => g.Min(x => x.i)).Select(g => g.Key).FirstOrDefault();

        var visited = venueIds.Where(venues.ContainsKey)
            .Select(id => new RecapVenue(id, venues[id].VenueName, venues[id].Latitude, venues[id].Longitude)).ToList();

        var id = userId.ToString();
        var user = await db.Users.Where(u => u.Id == id).Select(u => new { u.UserName, u.GlowLifetime }).FirstAsync(ct);
        return new NightRecap(night, CityName(city), GlowRules.Headline(visited.Count), minutesOut, visited,
            entries.Sum(x => x.Points), mostly, (user.UserName ?? "").ToLowerInvariant(), GlowLevels.For(user.GlowLifetime).Name, shareUrl);
    }

    public async Task<string?> ShareTokenAsync(Guid userId, DateOnly night, CancellationToken ct) =>
        await Shares.Where(s => s.UserId == userId && s.NightDate == night).Select(s => s.Token).FirstOrDefaultAsync(ct);

    /// <summary>Makes (or finds) the night's share token. Null when there is no such night.</summary>
    public async Task<string?> ShareAsync(Guid userId, DateOnly night, DateTime now, CancellationToken ct)
    {
        if (await ShareTokenAsync(userId, night, ct) is { } existing) return existing;
        if (!await db.Set<GlowEntry>().AnyAsync(x => x.UserId == userId && x.NightDate == night && x.Kind == GlowKinds.Scan, ct)) return null;

        var share = new RecapShare { Token = NewToken(), UserId = userId, NightDate = night, CreatedAt = now };
        Shares.Add(share);
        try
        {
            await db.SaveChangesAsync(ct);
            return share.Token;
        }
        catch (DbUpdateException)
        {
            // Shared twice at once: the other request's token stands.
            db.ChangeTracker.Clear();
            return await ShareTokenAsync(userId, night, ct);
        }
    }

    public Task<int> UnshareAsync(Guid userId, DateOnly night, CancellationToken ct) =>
        Shares.Where(s => s.UserId == userId && s.NightDate == night).ExecuteDeleteAsync(ct);

    /// <summary>A shared recap by its token, or null.</summary>
    public async Task<(Guid UserId, DateOnly Night)?> ByTokenAsync(string token, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(token) || token.Length > 16) return null;
        var share = await Shares.Where(s => s.Token == token).Select(s => new { s.UserId, s.NightDate }).FirstOrDefaultAsync(ct);
        return share is null ? null : (share.UserId, share.NightDate);
    }

    /// <summary>16 URL-safe characters (96 random bits).</summary>
    private static string NewToken() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(12)).Replace('+', '-').Replace('/', '_');
}
