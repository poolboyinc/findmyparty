using FindMyParty.Mobile.ViewModels;

namespace FindMyParty.Mobile.Views;

public partial class ProfilePage : ContentPage
{
    private readonly ProfileViewModel _viewModel;

    public ProfilePage()
    {
        InitializeComponent();
        _viewModel = IPlatformApplication.Current!.Services
            .GetRequiredService<ProfileViewModel>();
        BindingContext = _viewModel;
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        await _viewModel.LoadAsync();
    }

    private async void OnLogoutClicked(object sender, EventArgs e)
    {
        var confirmed = await DisplayAlert(
            "Log Out",
            "Are you sure you want to log out?",
            "Log Out",
            "Cancel");

        if (confirmed)
            await _viewModel.LogoutAsync();
    }
}
