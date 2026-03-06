using FindMyParty.Mobile.Services.Auth;

namespace FindMyParty.Mobile;

public partial class App : Application
{
    private readonly IAuthService _authService;

    public App(IAuthService authService)
    {
        InitializeComponent();
        _authService = authService;
    }

    protected override Window CreateWindow(IActivationState? activationState)
    {
        return new Window(new AppShell());
    }

    protected override async void OnStart()
    {
        base.OnStart();

        var token = await _authService.GetTokenAsync();
        if (token != null)
            await Shell.Current.GoToAsync("//main");
    }
}
