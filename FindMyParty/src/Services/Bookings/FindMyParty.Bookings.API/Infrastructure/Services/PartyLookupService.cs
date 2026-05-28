using System.Net.Http.Json;
using FindMyParty.Bookings.API.Application.DTOs;

namespace FindMyParty.Bookings.API.Infrastructure.Services;

public class PartyLookupService : IPartyLookupService
{
    private readonly HttpClient _http;
    private readonly ILogger<PartyLookupService> _logger;

    public PartyLookupService(HttpClient http, ILogger<PartyLookupService> logger)
    {
        _http = http;
        _logger = logger;
    }

    public async Task<Dictionary<Guid, BookingPartyDto>> GetByIdsAsync(
        IEnumerable<Guid> ids,
        CancellationToken ct = default)
    {
        var idArray = ids?.Distinct().ToArray() ?? Array.Empty<Guid>();
        if (idArray.Length == 0)
            return new Dictionary<Guid, BookingPartyDto>();

        try
        {
            var response = await _http.PostAsJsonAsync(
                "api/parties/by-ids",
                new { ids = idArray },
                ct);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "Party lookup returned non-success status {StatusCode} for {Count} ids",
                    response.StatusCode,
                    idArray.Length);
                return new Dictionary<Guid, BookingPartyDto>();
            }

            var parties = await response.Content.ReadFromJsonAsync<List<BookingPartyDto>>(
                cancellationToken: ct);

            if (parties == null)
                return new Dictionary<Guid, BookingPartyDto>();

            return parties.ToDictionary(p => p.Id);
        }
        catch (Exception ex)
        {
            // Degrade gracefully — the bookings handler returns rows with a
            // null Party field so the client can render a placeholder card.
            _logger.LogWarning(
                ex,
                "Party lookup failed for {Count} ids; returning empty result",
                idArray.Length);
            return new Dictionary<Guid, BookingPartyDto>();
        }
    }
}
