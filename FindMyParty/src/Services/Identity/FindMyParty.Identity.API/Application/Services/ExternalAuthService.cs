using Google.Apis.Auth;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace FindMyParty.Identity.API.Application.Services;

public class ExternalAuthService(IConfiguration config) : IExternalAuthService
{
    // Caches Apple's OIDC discovery document and signing keys — auto-refreshes on key rotation
    private static readonly ConfigurationManager<OpenIdConnectConfiguration> _appleConfig =
        new(
            "https://appleid.apple.com/.well-known/openid-configuration",
            new OpenIdConnectConfigurationRetriever()
        );

    public Task<(string email, string providerId, string? name)> ValidateProviderTokenAsync(
        string provider, string idToken) =>
        provider.ToLowerInvariant() switch
        {
            "google" => ValidateGoogleAsync(idToken),
            "apple"  => ValidateAppleAsync(idToken),
            _        => throw new ArgumentException($"Unsupported provider: {provider}")
        };

    private async Task<(string, string, string?)> ValidateGoogleAsync(string idToken)
    {
        var settings = new GoogleJsonWebSignature.ValidationSettings
        {
            Audience = [config["Google:ClientId"]!]
        };

        var payload = await GoogleJsonWebSignature.ValidateAsync(idToken, settings);
        return (payload.Email, payload.Subject, payload.Name);
    }

    private async Task<(string, string, string?)> ValidateAppleAsync(string identityToken)
    {
        var oidcConfig = await _appleConfig.GetConfigurationAsync(CancellationToken.None);

        var handler = new JwtSecurityTokenHandler();
        var validationParams = new TokenValidationParameters
        {
            ValidIssuer         = "https://appleid.apple.com",
            ValidAudience       = config["Apple:BundleId"],
            IssuerSigningKeys   = oidcConfig.SigningKeys,
            ValidateLifetime    = true,
        };

        var principal = handler.ValidateToken(identityToken, validationParams, out _);

        var sub = principal.FindFirst("sub")?.Value
               ?? principal.FindFirst(ClaimTypes.NameIdentifier)?.Value
               ?? throw new SecurityTokenException("Apple token missing sub claim");

        var email = principal.FindFirst("email")?.Value
                 ?? principal.FindFirst(ClaimTypes.Email)?.Value;

        // Apple only sends the real email on the very first sign-in.
        // After that, email is absent — fall back to a deterministic placeholder so the
        // account can still be found by sub via UserLoginInfo.
        return (email ?? $"{sub}@privaterelay.appleid.com", sub, null);
    }
}
