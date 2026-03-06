using FindMyParty.Mobile.ViewModels;

namespace FindMyParty.Mobile.Views;

public partial class RegisterPage : ContentPage
{
    public RegisterPage()
    {
        InitializeComponent();
        BindingContext = IPlatformApplication.Current!.Services
            .GetRequiredService<RegisterViewModel>();
    }
}
