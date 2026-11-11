using FindMyParty.Api.Common;

namespace FindMyParty.Api.SignArt;

public class SignArtFeature : IFeature
{
    public void Add(IServiceCollection services, IConfiguration config)
    {
        services.AddSingleton<SignArtRenderer>();
        services.AddSingleton<SignArtCache>();
    }
}
