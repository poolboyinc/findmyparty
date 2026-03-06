using FindMyParty.Mobile.ViewModels;

namespace FindMyParty.Mobile.Views;

public partial class LoginPage : ContentPage
{
    public LoginPage()
    {
        InitializeComponent();
        BindingContext = IPlatformApplication.Current!.Services
            .GetRequiredService<LoginViewModel>();
    }
}
