using FindMyParty.Api.Parties;
using FindMyParty.Api.Venues;

namespace FindMyParty.Api.Common;

/// <summary>Runs every registered enricher over a response before it goes out. With none registered, nothing changes.</summary>
public class Enrichers(
    IEnumerable<IPartyEnricher> parties,
    IEnumerable<IPartyDetailEnricher> partyDetails,
    IEnumerable<IVenueEnricher> venues,
    IEnumerable<IVenueDetailEnricher> venueDetails)
{
    public async Task PartiesAsync(IReadOnlyList<PartyResponse> list, Guid? viewerId, CancellationToken ct = default)
    {
        if (list.Count == 0) return;
        foreach (var enricher in parties) await enricher.EnrichAsync(list, viewerId, ct);
    }

    public async Task PartyAsync(PartyDetailResponse party, Guid? viewerId, CancellationToken ct = default)
    {
        foreach (var enricher in partyDetails) await enricher.EnrichAsync(party, viewerId, ct);
    }

    public async Task VenuesAsync(IReadOnlyList<VenueSummary> list, Guid? viewerId, CancellationToken ct = default)
    {
        if (list.Count == 0) return;
        foreach (var enricher in venues) await enricher.EnrichAsync(list, viewerId, ct);
    }

    public async Task VenueAsync(VenueResponse venue, Guid? viewerId, CancellationToken ct = default)
    {
        foreach (var enricher in venueDetails) await enricher.EnrichAsync(venue, viewerId, ct);
    }
}
