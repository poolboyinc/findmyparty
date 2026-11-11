using FindMyParty.Api.Common;

namespace FindMyParty.Api.Door;

public class DoorFeature : IFeature
{
    public void Add(IServiceCollection services, IConfiguration config)
    {
        services.AddScoped<IVenueAccess, DoorVenueAccess>();
        services.AddScoped<DoorService>();
        services.AddScoped<DoorStaffService>();
        services.AddScoped<IAccountCleanup, DoorCleanup>();
    }
}
