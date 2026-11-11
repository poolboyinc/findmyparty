using FindMyParty.Api.Common;

namespace FindMyParty.Api.Bookings;

/// <summary>Bookings, guest passes and the hold. (BookingService and PassService themselves are registered in Program.cs.)</summary>
public class BookingsFeature : IFeature
{
    public void Add(IServiceCollection services, IConfiguration config)
    {
        services.AddHttpContextAccessor();
        services.AddScoped<GuestPassLinks>();
        services.AddScoped<GuestPassService>();
        services.AddScoped<IAccountCleanup, BookingsCleanup>();
        services.AddSingleton<HoldSweeper>();
        services.AddHostedService(sp => sp.GetRequiredService<HoldSweeper>());
    }
}
