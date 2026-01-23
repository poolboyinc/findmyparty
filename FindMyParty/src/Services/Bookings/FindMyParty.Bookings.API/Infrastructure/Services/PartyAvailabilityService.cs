using System.Net.Http.Json;

namespace FindMyParty.Bookings.API.Infrastructure.Services
{
    public class PartyAvailabilityService : IPartyAvailabilityService
    {
        private readonly HttpClient _http;

        public PartyAvailabilityService(HttpClient http)
        {
            _http = http;
        }

        public async Task<PartyAvailabilityResult> CheckAvailabilityAsync(
            Guid partyId,
            int requestedTickets)
        {
            var result = await _http.GetFromJsonAsync<PartyAvailabilityResult>(
                $"api/parties/{partyId}/availability");

            if (result == null)
                throw new InvalidOperationException("Party not found");

            if (result.RemainingCapacity < requestedTickets)
                return result with { IsAvailable = false };

            return result;
        }
    }
}
