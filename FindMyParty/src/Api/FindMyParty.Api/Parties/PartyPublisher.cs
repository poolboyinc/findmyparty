using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using FindMyParty.Api.Venues;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Parties;

/// <summary>When a venue publishes a party, its followers hear about it ("party_published", category Venues).</summary>
public class PartyPublisher(AppDbContext db, INotifier notifier)
{
    public async Task TellFollowersAsync(Party party, CancellationToken ct = default)
    {
        if (party.VenueId is not { } venueId) return;
        var followers = await db.Set<VenueFollow>().Where(f => f.VenueId == venueId).Select(f => f.UserId).ToListAsync(ct);
        followers.Remove(party.HostId);
        if (followers.Count == 0) return;

        var venue = await db.VenueProfiles.AsNoTracking().Where(v => v.Id == venueId).Select(v => new { v.VenueName, v.CitySlug }).FirstAsync(ct);
        var when = Money.When(party.StartsAt, venue.CitySlug);
        var body = party.Price > 0 ? $"{when}, {Money.Text(party.Price)} at the door" : $"{when}, free entry";
        await notifier.SendAsync(new Push(followers, "party_published", $"{venue.VenueName}: {party.Title}", body,
            new { partyId = party.Id, venueId }, NotifyCategory.Venues), ct);
    }
}
