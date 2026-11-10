using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Google.Apis.Auth;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace FindMyParty.Api.Identity;

public record ExternalIdentity(string Email, string ProviderId, string? Name, bool EmailVerified);

public interface IExternalAuthService
{
    /// <summary>Validates a Google or Apple id token. Throws if the token is not valid.</summary>
    Task<ExternalIdentity> ValidateAsync(string provider, string idToken);
}

public class ExternalAuthService(IConfiguration config) : IExternalAuthService
{
    // Caches Apple's signing keys and refreshes them when Apple rotates.
    private static readonly ConfigurationManager<OpenIdConnectConfiguration> AppleConfig =
        new("https://appleid.apple.com/.well-known/openid-configuration", new OpenIdConnectConfigurationRetriever());

    public Task<ExternalIdentity> ValidateAsync(string provider, string idToken) =>
        provider.ToLowerInvariant() switch
        {
            "google" => ValidateGoogleAsync(idToken),
            "apple" => ValidateAppleAsync(idToken),
            _ => throw new ArgumentException($"Unsupported provider: {provider}")
        };

    private async Task<ExternalIdentity> ValidateGoogleAsync(string idToken)
    {
        var settings = new GoogleJsonWebSignature.ValidationSettings { Audience = [config["Google:ClientId"]!] };
        var payload = await GoogleJsonWebSignature.ValidateAsync(idToken, settings);
        return new ExternalIdentity(payload.Email, payload.Subject, payload.Name, payload.EmailVerified);
    }

    private async Task<ExternalIdentity> ValidateAppleAsync(string identityToken)
    {
        var oidc = await AppleConfig.GetConfigurationAsync(CancellationToken.None);
        var principal = new JwtSecurityTokenHandler().ValidateToken(identityToken, new TokenValidationParameters
        {
            ValidIssuer = "https://appleid.apple.com",
            ValidAudience = config["Apple:BundleId"],
            IssuerSigningKeys = oidc.SigningKeys,
            ValidateLifetime = true,
        }, out _);

        var sub = principal.FindFirst("sub")?.Value
                  ?? principal.FindFirst(ClaimTypes.NameIdentifier)?.Value
                  ?? throw new SecurityTokenException("Apple token missing sub claim");
        var email = principal.FindFirst("email")?.Value ?? principal.FindFirst(ClaimTypes.Email)?.Value;

        // Apple sends the real email only on the first sign-in; afterwards the account is found by `sub`.
        return new ExternalIdentity(email ?? $"{sub}@privaterelay.appleid.com", sub, null, EmailVerified: true);
    }
}
