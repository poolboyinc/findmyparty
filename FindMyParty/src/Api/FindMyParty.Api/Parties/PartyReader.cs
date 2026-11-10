using FindMyParty.Api.Bookings;
using FindMyParty.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Parties;

/// <summary>Builds the public view of parties: with the venue's name and the crowd as a range.</summary>
public class PartyReader(AppDbContext db)
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
                CheckedIn = db.Bookings.Where(b => b.PartyId == p.Id && b.Status != BookingStatus.Cancelled).Sum(b => (int?)b.CheckedInCount) ?? 0
            }).AsNoTracking().ToListAsync(ct);

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
                CrowdSource = source
            };
        }).ToList();
    }

    /// <summary>Published parties that have not ended.</summary>
    public IQueryable<Party> Open() =>
        db.Parties.Where(p => p.Status == PartyStatus.Published && !p.IsDeleted && p.EndsAt >= DateTime.UtcNow);
}

public static class Geo
{
    private const double KmPerDegree = 111.32;
    public const double ToRad = Math.PI / 180;

    /// <summary>Half-height and half-width, in degrees, of a box that contains the circle.</summary>
    public static (double Lat, double Lng) Box(double lat, double radiusKm) =>
        (radiusKm / KmPerDegree, radiusKm / (KmPerDegree * Math.Max(Math.Cos(lat * ToRad), 0.01)));
}
