using FindMyParty.Mobile.Services.Auth;

namespace FindMyParty.Mobile.Views;

public partial class SplashPage : ContentPage
{
    private readonly IAuthService _authService;

    public SplashPage()
    {
        InitializeComponent();
        _authService = IPlatformApplication.Current!.Services
            .GetRequiredService<IAuthService>();
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();

        await Task.Delay(2000);

        var token = await _authService.GetTokenAsync();
        if (token != null)
            await Shell.Current.GoToAsync("//main");
        else
            await Shell.Current.GoToAsync("//login");
    }
}
