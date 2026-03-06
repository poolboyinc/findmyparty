using FindMyParty.Mobile.Views;

namespace FindMyParty.Mobile;

public partial class AppShell : Shell
{
    public AppShell()
    {
        InitializeComponent();
        Routing.RegisterRoute("partyDetail", typeof(PartyDetailPage));
    }
}
