using FindMyParty.Mobile.Models.Parties;

namespace FindMyParty.Mobile.Services.Parties;

public interface IPartyService
{
    Task<List<PartyMapItem>> GetPartiesAsync(double lat, double lng);
    Task<PartyDetail?> GetPartyByIdAsync(Guid partyId);
}
