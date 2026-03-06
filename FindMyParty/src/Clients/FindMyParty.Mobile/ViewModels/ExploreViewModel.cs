using FindMyParty.Mobile.Models.Parties;
using FindMyParty.Mobile.Services.Parties;

namespace FindMyParty.Mobile.ViewModels;

public class ExploreViewModel : BaseViewModel
{
    private readonly IPartyService _partyService;

    public List<PartyMapItem> Parties { get; private set; } = [];

    public ExploreViewModel(IPartyService partyService)
    {
        _partyService = partyService;
    }

    public async Task<List<PartyMapItem>> LoadPartiesAsync(double lat, double lng)
    {
        IsBusy = true;
        try
        {
            Parties = await _partyService.GetPartiesAsync(lat, lng);
            return Parties;
        }
        catch
        {
            return [];
        }
        finally
        {
            IsBusy = false;
        }
    }
}
