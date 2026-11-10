using FindMyParty.Api.Data;
using FindMyParty.Api.Parties;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Venues;

/// <summary>Venues as the public sees them. On the map a venue is one beam, however many parties it has.</summary>
[ApiController]
[Route("api/venues")]
public class VenuesController(AppDbContext db, PartyReader reader) : ControllerBase
{
    /// <summary>
    /// Venues, each with its next open party and that party's crowd range.
    /// Pass lat, lng and radiusKm together to get only venues within that distance.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] double? lat,
        [FromQuery] double? lng,
        [FromQuery] double? radiusKm,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var query = db.VenueProfiles.AsNoTracking();
        if (lat is { } lat0 && lng is { } lng0 && radiusKm is > 0)
        {
            var (dLat, dLng) = Geo.Box(lat0, radiusKm.Value);
            var r = radiusKm.Value;
            const double toRad = Geo.ToRad;
            query = query
                .Where(v => v.Latitude >= lat0 - dLat && v.Latitude <= lat0 + dLat && v.Longitude >= lng0 - dLng && v.Longitude <= lng0 + dLng)
                .Where(v => 6371 * 2 * Math.Asin(Math.Sqrt(
                    Math.Pow(Math.Sin((v.Latitude - lat0) * toRad / 2), 2) +
                    Math.Cos(lat0 * toRad) * Math.Cos(v.Latitude * toRad) * Math.Pow(Math.Sin((v.Longitude - lng0) * toRad / 2), 2))) <= r);
        }

        var venues = await query.OrderBy(v => v.VenueName).ThenBy(v => v.Id).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(v => new { v.Id, v.VenueName, v.Latitude, v.Longitude }).ToListAsync(ct);
        var ids = venues.Select(v => (Guid?)v.Id).ToList();
        var next = (await reader.ToResponsesAsync(reader.Open().Where(p => ids.Contains(p.VenueId)), ct))
            .GroupBy(p => p.VenueId!.Value)
            .ToDictionary(g => g.Key, g => g.First()); // already soonest first

        return Ok(venues.Select(v =>
        {
            next.TryGetValue(v.Id, out var party);
            return new VenueSummary(v.Id, v.VenueName, v.Latitude, v.Longitude, party?.CrowdLevel, party?.CrowdSource, party?.Id, party?.Title);
        }));
    }

    /// <summary>A venue's page: where it is, when it opens, and its open parties, soonest first.</summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var v = await db.VenueProfiles.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (v is null) return NotFound();

        var parties = await reader.ToResponsesAsync(reader.Open().Where(p => p.VenueId == id).OrderBy(p => p.StartsAt).Take(30), ct);
        var next = parties.FirstOrDefault();
        return Ok(new VenueResponse(v.Id, v.VenueName, v.Address, v.Latitude, v.Longitude, v.WorkingHoursOpen, v.WorkingHoursClose, v.WorkingDays,
            next?.CrowdLevel, next?.CrowdSource, parties));
    }
}
