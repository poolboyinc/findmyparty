using FindMyParty.Api.Common;

namespace FindMyParty.Api.Parties;

public class PartiesFeature : IFeature
{
    public void Add(IServiceCollection services, IConfiguration config)
    {
        services.AddScoped<PartyPublisher>();
    }
}
