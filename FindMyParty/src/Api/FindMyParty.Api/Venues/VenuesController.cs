using System.Text.Json;
using FindMyParty.Api.Cities;
using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using FindMyParty.Api.Identity;
using FindMyParty.Api.Parties;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Venues;

/// <summary>Venues as the public sees them. On the map a venue is one beam, however many parties it has.</summary>
[ApiController]
[Route("api/venues")]
public class VenuesController(AppDbContext db, PartyReader reader, Enrichers enrich, VenueTonightService tonight, TimeProvider time) : ControllerBase
{
    /// <summary>
    /// Venues, each with its next open party and that party's crowd range. `city` keeps that city's venues.
    /// Pass lat, lng and radiusKm together to get only venues within that distance.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] string? city,
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
        if (await CityLookup.RequireAsync(db, city, ct) is { } slug)
            query = query.Where(v => v.CitySlug == slug);
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
            .Select(v => new { v.Id, v.VenueName, v.Latitude, v.Longitude, v.CitySlug, v.Kind, v.Area, v.Footprint, v.BuildingHeightM }).ToListAsync(ct);
        var ids = venues.Select(v => (Guid?)v.Id).ToList();
        var next = (await reader.ToResponsesAsync(reader.Open().Where(p => ids.Contains(p.VenueId)), ct))
            .GroupBy(p => p.VenueId!.Value)
            .ToDictionary(g => g.Key, g => g.First()); // already soonest first

        var summaries = venues.Select(v =>
        {
            next.TryGetValue(v.Id, out var party);
            return new VenueSummary
            {
                Id = v.Id,
                Name = v.VenueName,
                Latitude = v.Latitude,
                Longitude = v.Longitude,
                CrowdLevel = party?.CrowdLevel,
                CrowdSource = party?.CrowdSource,
                PartyId = party?.Id,
                PartyTitle = party?.Title,
                City = v.CitySlug,
                Kind = v.Kind,
                Area = v.Area,
                PartyGenre = party?.Genre,
                PartyPrice = party?.Price,
                PartyStartsAt = party?.StartsAt,
                PartyEndsAt = party?.EndsAt,
                PartyLineupText = party?.LineupText,
                Footprint = Footprint.From(v.Footprint, v.BuildingHeightM),
            };
        }).ToList();
        await enrich.VenuesAsync(summaries, User.OptionalUserId(), ct); // other features add their fields here; keep this call
        return Ok(summaries);
    }

    /// <summary>A venue's page: where it is, when it opens, its open parties soonest first, and tonight by hour.</summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var v = await db.VenueProfiles.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (v is null) return NotFound();
        var viewer = User.OptionalUserId();

        var parties = await reader.ToResponsesAsync(reader.Open().Where(p => p.VenueId == id).OrderBy(p => p.StartsAt).Take(30), ct);
        await enrich.PartiesAsync(parties, viewer, ct); // the party enrichers run on the venue's parties too; keep this call
        var next = parties.FirstOrDefault();
        var venue = new VenueResponse
        {
            Id = v.Id,
            Name = v.VenueName,
            Address = v.Address,
            Latitude = v.Latitude,
            Longitude = v.Longitude,
            WorkingHoursOpen = v.WorkingHoursOpen,
            WorkingHoursClose = v.WorkingHoursClose,
            WorkingDays = v.WorkingDays,
            CrowdLevel = next?.CrowdLevel,
            CrowdSource = next?.CrowdSource,
            Parties = parties,
            City = v.CitySlug,
            Kind = v.Kind,
            Area = v.Area,
            ImageUrl = v.ImageUrl,
            Footprint = Footprint.From(v.Footprint, v.BuildingHeightM),
            Following = viewer is { } who && await db.Set<VenueFollow>().AnyAsync(f => f.UserId == who && f.VenueId == id, ct),
            Tonight = await tonight.ForAsync(v.Id, v.CitySlug, ct),
        };
        await enrich.VenueAsync(venue, viewer, ct); // other features add their fields here; keep this call
        return Ok(venue);
    }

    /// <summary>Follow a venue: a push when it publishes a party. Following twice is one follow.</summary>
    [Authorize]
    [HttpPut("{id:guid}/follow")]
    public async Task<IActionResult> Follow(Guid id, CancellationToken ct)
    {
        if (!await db.VenueProfiles.AnyAsync(v => v.Id == id, ct)) throw ApiException.NotFound("Venue");
        var userId = User.UserId();
        // One statement, so two taps at once cannot both insert.
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"""INSERT INTO "VenueFollows" ("UserId", "VenueId", "CreatedAt") VALUES ({userId}, {id}, {time.GetUtcNow().UtcDateTime}) ON CONFLICT DO NOTHING""", ct);
        return NoContent();
    }

    [Authorize]
    [HttpDelete("{id:guid}/follow")]
    public async Task<IActionResult> Unfollow(Guid id, CancellationToken ct)
    {
        var userId = User.UserId();
        await db.Set<VenueFollow>().Where(f => f.UserId == userId && f.VenueId == id).ExecuteDeleteAsync(ct);
        return NoContent();
    }

    /// <summary>The outline of the venue's building, for the map. The platform admin or the venue's own host.</summary>
    [Authorize]
    [HttpPut("{id:guid}/footprint")]
    public async Task<IActionResult> SetFootprint(Guid id, [FromBody] FootprintRequest request, CancellationToken ct)
    {
        var venue = await db.VenueProfiles.FirstOrDefaultAsync(v => v.Id == id, ct) ?? throw ApiException.NotFound("Venue");
        if (!User.IsInRole(Roles.Admin) && !(User.IsInRole(Roles.Host) && venue.UserId == User.UserIdString()))
            throw ApiException.Forbidden();

        var ring = request.Ring;
        if (ring is null || ring.Length is < 4 or > 200)
            throw ApiException.Invalid("A footprint has 4 to 200 points.", "footprint_invalid");
        if (ring.Any(p => p is not { Length: 2 } || p[0] is < -180 or > 180 || p[1] is < -90 or > 90))
            throw ApiException.Invalid("Each point is [longitude, latitude].", "footprint_invalid");
        if (request.HeightM is not (> 0 and <= 1000))
            throw ApiException.Invalid("The building's height is in metres, above 0.", "footprint_invalid");

        venue.Footprint = JsonSerializer.Serialize(ring);
        venue.BuildingHeightM = request.HeightM;
        await db.SaveChangesAsync(ct);
        return NoContent();
    }
}
