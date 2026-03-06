using FindMyParty.Mobile.ViewModels;

namespace FindMyParty.Mobile.Views;

[QueryProperty(nameof(PartyId), "id")]
public partial class PartyDetailPage : ContentPage
{
    private readonly PartyDetailViewModel _viewModel;

    public string? PartyId
    {
        set
        {
            if (Guid.TryParse(value, out var id))
                _ = _viewModel.LoadAsync(id);
        }
    }

    public PartyDetailPage()
    {
        InitializeComponent();
        _viewModel = IPlatformApplication.Current!.Services
            .GetRequiredService<PartyDetailViewModel>();
        BindingContext = _viewModel;
    }
}
