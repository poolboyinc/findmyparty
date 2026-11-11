using FindMyParty.Api.Common;

namespace FindMyParty.Api.Me;

public class MeFeature : IFeature
{
    public void Add(IServiceCollection services, IConfiguration config)
    {
        services.AddScoped<MeService>();
        services.AddScoped<SavedService>();
        services.AddScoped<IAccountCleanup, SavedCleanup>();
    }
}
