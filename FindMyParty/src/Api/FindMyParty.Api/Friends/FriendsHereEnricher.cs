using FindMyParty.Api.Common;
using FindMyParty.Api.Parties;
using FindMyParty.Api.Venues;

namespace FindMyParty.Api.Friends;

/// <summary>
/// Adds `friendsHere` to parties and venues: the viewer's friends who are in there now. The key is left out when
/// nobody is, when the viewer is signed out, and when the viewer does not share (see PresenceService for every rule).
/// </summary>
public class FriendsHereEnricher(PresenceService presence) : IPartyEnricher, IPartyDetailEnricher, IVenueEnricher, IVenueDetailEnricher
{
    public const string Key = "friendsHere";

    public async Task EnrichAsync(IReadOnlyList<PartyResponse> parties, Guid? viewerId, CancellationToken ct)
    {
        if (await OutAsync(viewerId, ct) is not { Count: > 0 } friends) return;
        foreach (var party in parties) Write(party.Extra, friends.Where(f => f.PartyId == party.Id));
    }

    public async Task EnrichAsync(PartyDetailResponse party, Guid? viewerId, CancellationToken ct)
    {
        if (await OutAsync(viewerId, ct) is not { Count: > 0 } friends) return;
        Write(party.Extra, friends.Where(f => f.PartyId == party.Id));
    }

    public async Task EnrichAsync(IReadOnlyList<VenueSummary> venues, Guid? viewerId, CancellationToken ct)
    {
        if (await OutAsync(viewerId, ct) is not { Count: > 0 } friends) return;
        foreach (var venue in venues) Write(venue.Extra, friends.Where(f => f.VenueId == venue.Id));
    }

    public async Task EnrichAsync(VenueResponse venue, Guid? viewerId, CancellationToken ct)
    {
        if (await OutAsync(viewerId, ct) is not { Count: > 0 } friends) return;
        Write(venue.Extra, friends.Where(f => f.VenueId == venue.Id));
    }

    private async Task<IReadOnlyList<FriendPresence>?> OutAsync(Guid? viewerId, CancellationToken ct) =>
        viewerId is { } id ? await presence.FriendsOutAsync(id, ct) : null;

    private static void Write(Dictionary<string, object?> extra, IEnumerable<FriendPresence> friends)
    {
        if (PresenceService.Here(friends) is { } here) extra[Key] = here;
    }
}
