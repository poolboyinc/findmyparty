using FindMyParty.Api.Common;

namespace FindMyParty.Api.Venues;

public class VenuesFeature : IFeature
{
    public void Add(IServiceCollection services, IConfiguration config)
    {
        services.AddScoped<VenueTonightService>();
        services.AddScoped<IAccountCleanup, VenueFollowCleanup>();
    }
}
