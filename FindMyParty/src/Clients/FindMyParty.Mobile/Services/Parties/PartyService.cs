using FindMyParty.Mobile.Constants;
using FindMyParty.Mobile.Models.Parties;
using System.Net.Http.Json;

namespace FindMyParty.Mobile.Services.Parties;

public class PartyService : IPartyService
{
    private readonly HttpClient _http;

    public PartyService()
    {
        _http = new HttpClient
        {
            BaseAddress = new Uri(ApiConstants.PartiesBaseUrl)
        };
    }

    public async Task<List<PartyMapItem>> GetPartiesAsync(double lat, double lng)
    {
        var result = await _http.GetFromJsonAsync<List<PartyMapItem>>(
            $"api/parties?lat={lat.ToString(System.Globalization.CultureInfo.InvariantCulture)}" +
            $"&lng={lng.ToString(System.Globalization.CultureInfo.InvariantCulture)}" +
            "&page=1&pageSize=100");

        return result ?? [];
    }

    public async Task<PartyDetail?> GetPartyByIdAsync(Guid partyId)
    {
        return await _http.GetFromJsonAsync<PartyDetail>($"api/parties/{partyId}");
    }
}
