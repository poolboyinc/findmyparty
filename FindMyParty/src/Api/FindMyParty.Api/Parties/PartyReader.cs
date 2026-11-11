using FindMyParty.Api.Bookings;
using FindMyParty.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Parties;

/// <summary>Builds the public view of parties: with the venue's name and the crowd as a range.</summary>
public class PartyReader(AppDbContext db, TimeProvider time)
{
    public async Task<List<PartyResponse>> ToResponsesAsync(IQueryable<Party> parties, CancellationToken ct = default)
    {
        var rows = await (
            from p in parties
            join v in db.VenueProfiles on p.VenueId equals (Guid?)v.Id into venues
            from v in venues.DefaultIfEmpty()
            select new
            {
                p,
                VenueName = (string?)v.VenueName,
                City = (string?)v.CitySlug,
                VenueArea = (string?)v.Area,
                CheckedIn = db.Bookings.Where(b => b.PartyId == p.Id && b.Status != BookingStatus.Cancelled).Sum(b => (int?)b.CheckedInCount) ?? 0
            }).AsNoTracking().ToListAsync(ct);
        var acts = await Lineup.ForAsync(db, rows.Select(r => r.p.Id).ToList(), ct);

        return rows.OrderBy(r => r.p.StartsAt).Select(r =>
        {
            var (level, source) = Crowd.Of(r.p.TicketsSold, r.CheckedIn);
            return new PartyResponse
            {
                Id = r.p.Id,
                Title = r.p.Title,
                Price = r.p.Price,
                StartsAt = r.p.StartsAt,
                EndsAt = r.p.EndsAt,
                Latitude = r.p.Latitude,
                Longitude = r.p.Longitude,
                IsSoldOut = r.p.TicketsSold >= r.p.Capacity,
                ImageUrl = r.p.ImageUrl,
                Genre = r.p.Genre,
                AttendeeCount = r.p.TicketsSold,
                VenueId = r.p.VenueId,
                VenueName = r.VenueName,
                CrowdLevel = level,
                CrowdSource = source,
                City = r.City,
                VenueArea = r.VenueArea,
                AgeLimit = r.p.AgeLimit,
                LineupText = Lineup.Text(acts.GetValueOrDefault(r.p.Id), r.p.PerformerName)
            };
        }).ToList();
    }

    /// <summary>Published parties that have not ended.</summary>
    public IQueryable<Party> Open()
    {
        var now = time.GetUtcNow().UtcDateTime;
        return db.Parties.Where(p => p.Status == PartyStatus.Published && !p.IsDeleted && p.EndsAt >= now);
    }

    /// <summary>Published parties on right now.</summary>
    public IQueryable<Party> Running()
    {
        var now = time.GetUtcNow().UtcDateTime;
        return db.Parties.Where(p => p.Status == PartyStatus.Published && !p.IsDeleted && p.StartsAt <= now && p.EndsAt > now);
    }

    /// <summary>Guests let in so far: the exact number, for computing a range or a total, never for showing a guest.</summary>
    public async Task<int> CheckedInAsync(Guid partyId, CancellationToken ct = default) =>
        await db.Bookings.Where(b => b.PartyId == partyId && b.Status != BookingStatus.Cancelled).SumAsync(b => (int?)b.CheckedInCount, ct) ?? 0;
}

public static class Geo
{
    private const double KmPerDegree = 111.32;
    public const double ToRad = Math.PI / 180;

    /// <summary>Half-height and half-width, in degrees, of a box that contains the circle.</summary>
    public static (double Lat, double Lng) Box(double lat, double radiusKm) =>
        (radiusKm / KmPerDegree, radiusKm / (KmPerDegree * Math.Max(Math.Cos(lat * ToRad), 0.01)));

    /// <summary>Great-circle distance in kilometres.</summary>
    public static double DistanceKm(double lat1, double lng1, double lat2, double lng2) =>
        6371 * 2 * Math.Asin(Math.Sqrt(
            Math.Pow(Math.Sin((lat2 - lat1) * ToRad / 2), 2) +
            Math.Cos(lat1 * ToRad) * Math.Cos(lat2 * ToRad) * Math.Pow(Math.Sin((lng2 - lng1) * ToRad / 2), 2)));
}
