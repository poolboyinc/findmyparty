using FindMyParty.Api.Cities;
using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using FindMyParty.Api.Parties;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Share;

/// <summary>The pages behind a shared party (/p/{id}) or venue (/v/{id}): a preview for chat apps, then the app.</summary>
[ApiController]
public class PartyPages(AppDbContext db, SharePage share) : ControllerBase
{
    [HttpGet("/p/{id}")]
    public async Task<IActionResult> Party(string id, CancellationToken ct)
    {
        if (!Guid.TryParse(id, out var partyId)) return SharePage.Result(share.NotFound(), StatusCodes.Status404NotFound);
        var party = await (
            from p in db.Parties
            where p.Id == partyId && !p.IsDeleted && p.Status != PartyStatus.Draft
            join v in db.VenueProfiles on p.VenueId equals (Guid?)v.Id into venues
            from v in venues.DefaultIfEmpty()
            select new { p.Id, p.Title, p.StartsAt, p.Price, p.ImageUrl, VenueName = (string?)v.VenueName, City = (string?)v.CitySlug })
            .AsNoTracking().FirstOrDefaultAsync(ct);
        if (party is null) return SharePage.Result(share.NotFound(), StatusCodes.Status404NotFound);

        var title = party.VenueName is null ? party.Title : $"{party.Title} at {party.VenueName}";
        var entry = party.Price > 0 ? $"{Money.Text(party.Price)} at the door." : "Free entry.";
        var description = $"{Money.When(party.StartsAt, party.City)}. {entry}";
        var image = string.IsNullOrWhiteSpace(party.ImageUrl) ? Links.PublicUrl(HttpContext, "/og.png") : party.ImageUrl;
        return SharePage.Result(share.Render(title, description, image, $"party/{party.Id}"));
    }

    [HttpGet("/v/{id}")]
    public async Task<IActionResult> Venue(string id, CancellationToken ct)
    {
        if (!Guid.TryParse(id, out var venueId)) return SharePage.Result(share.NotFound(), StatusCodes.Status404NotFound);
        var venue = await db.VenueProfiles.AsNoTracking().Where(v => v.Id == venueId)
            .Select(v => new { v.Id, v.VenueName, v.ImageUrl, v.CitySlug }).FirstOrDefaultAsync(ct);
        if (venue is null) return SharePage.Result(share.NotFound(), StatusCodes.Status404NotFound);

        var city = await db.Set<City>().Where(c => c.Slug == venue.CitySlug).Select(c => c.Name).FirstOrDefaultAsync(ct);
        var title = city is null ? venue.VenueName : $"{venue.VenueName}, {city}";
        var image = string.IsNullOrWhiteSpace(venue.ImageUrl) ? Links.PublicUrl(HttpContext, "/og.png") : venue.ImageUrl;
        return SharePage.Result(share.Render(title, "See what is on tonight.", image, $"venue/{venue.Id}"));
    }
}
