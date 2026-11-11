using FindMyParty.Api.Bookings;
using FindMyParty.Api.Data;
using FindMyParty.Api.Parties;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Cities;

public record CityResponse(string Slug, string Name, double Latitude, double Longitude, double RadiusKm, int OutTonight, int VenuesLit, int VenueCount);

/// <summary>The cities FindMyParty is in, each with tonight's pulse. Works signed out (the welcome screen shows it).</summary>
[ApiController]
[Route("api/cities")]
public class CitiesController(AppDbContext db, PartyReader reader) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var cities = await db.Set<City>().AsNoTracking().OrderBy(c => c.Order).ToListAsync(ct);
        var venues = await db.VenueProfiles.GroupBy(v => v.CitySlug).Select(g => new { City = g.Key, Count = g.Count() }).ToListAsync(ct);

        // Guests inside each running party, with the party's venue and city.
        var running = await (
            from p in reader.Running()
            join v in db.VenueProfiles on p.VenueId equals (Guid?)v.Id
            select new
            {
                City = v.CitySlug,
                VenueId = v.Id,
                Inside = db.Bookings.Where(b => b.PartyId == p.Id && b.Status != BookingStatus.Cancelled).Sum(b => (int?)b.CheckedInCount) ?? 0
            }).ToListAsync(ct);

        return Ok(cities.Select(c =>
        {
            var here = running.Where(r => r.City == c.Slug).ToList();
            return new CityResponse(c.Slug, c.Name, c.Latitude, c.Longitude, c.RadiusKm,
                CityPulse.RoundDown(here.Sum(r => r.Inside)),
                here.Where(r => r.Inside > 0).Select(r => r.VenueId).Distinct().Count(),
                venues.FirstOrDefault(v => v.City == c.Slug)?.Count ?? 0);
        }));
    }
}
