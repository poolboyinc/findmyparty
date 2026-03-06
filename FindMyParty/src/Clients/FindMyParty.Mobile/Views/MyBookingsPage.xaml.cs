using FindMyParty.Mobile.ViewModels;

namespace FindMyParty.Mobile.Views;

public partial class MyBookingsPage : ContentPage
{
    private readonly MyBookingsViewModel _viewModel;

    public MyBookingsPage()
    {
        InitializeComponent();
        _viewModel = IPlatformApplication.Current!.Services
            .GetRequiredService<MyBookingsViewModel>();
        BindingContext = _viewModel;
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        await _viewModel.LoadAsync();
    }

    private async void OnViewPartyClicked(object sender, EventArgs e)
    {
        if (sender is Button btn && btn.CommandParameter is Guid partyId)
            await Shell.Current.GoToAsync($"partyDetail?id={partyId}");
    }
}
