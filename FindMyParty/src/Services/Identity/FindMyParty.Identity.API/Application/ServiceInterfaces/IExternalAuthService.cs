namespace FindMyParty.Identity.API.Application.Services;

public interface IExternalAuthService
{
    Task<(string email, string providerId, string? name)> ValidateProviderTokenAsync(string provider, string idToken);
}
