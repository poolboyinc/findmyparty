using FindMyParty.Mobile.Services.Auth;
using FindMyParty.Mobile.Services.Bookings;
using FindMyParty.Mobile.Services.Parties;
using FindMyParty.Mobile.ViewModels;
using FindMyParty.Mobile.Views;
using Microsoft.Extensions.Logging;

namespace FindMyParty.Mobile;

public static class MauiProgram
{
    public static MauiApp CreateMauiApp()
    {
        var builder = MauiApp.CreateBuilder();
        builder
            .UseMauiApp<App>()
            .ConfigureFonts(fonts =>
            {
                fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
                fonts.AddFont("OpenSans-Semibold.ttf", "OpenSansSemibold");
            });

        // Services
        builder.Services.AddSingleton<IAuthService, AuthService>();
        builder.Services.AddSingleton<IPartyService, PartyService>();
        builder.Services.AddSingleton<IBookingService, BookingService>();

        // ViewModels
        builder.Services.AddTransient<LoginViewModel>();
        builder.Services.AddTransient<RegisterViewModel>();
        builder.Services.AddTransient<ExploreViewModel>();
        builder.Services.AddTransient<PartyDetailViewModel>();
        builder.Services.AddTransient<MyBookingsViewModel>();
        builder.Services.AddTransient<ProfileViewModel>();

        // Pages
        builder.Services.AddTransient<LoginPage>();
        builder.Services.AddTransient<RegisterPage>();
        builder.Services.AddTransient<ExplorePage>();
        builder.Services.AddTransient<PartyDetailPage>();
        builder.Services.AddTransient<MyBookingsPage>();
        builder.Services.AddTransient<ProfilePage>();

#if DEBUG
        builder.Logging.AddDebug();
#endif

        return builder.Build();
    }
}
