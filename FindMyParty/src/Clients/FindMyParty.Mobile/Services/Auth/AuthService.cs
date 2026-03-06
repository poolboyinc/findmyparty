using FindMyParty.Mobile.Constants;
using FindMyParty.Mobile.Models.Auth;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

namespace FindMyParty.Mobile.Services.Auth;

public class AuthService : IAuthService
{
    private readonly HttpClient _http;
    private const string TokenKey = "auth_token";

    public bool IsAuthenticated { get; private set; }

    public AuthService()
    {
        _http = new HttpClient
        {
            BaseAddress = new Uri(ApiConstants.IdentityBaseUrl)
        };
    }

    public async Task<bool> LoginAsync(string email, string password)
    {
        var response = await _http.PostAsJsonAsync("api/auth/login", new LoginRequest
        {
            Email = email,
            Password = password
        });

        if (!response.IsSuccessStatusCode)
            return false;

        var result = await response.Content.ReadFromJsonAsync<AuthResponse>();
        if (result?.AccessToken == null)
            return false;

        await SecureStorage.Default.SetAsync(TokenKey, result.AccessToken);
        IsAuthenticated = true;
        return true;
    }

    public async Task<bool> RegisterAsync(string userName, string email, string password)
    {
        var response = await _http.PostAsJsonAsync("api/auth/register", new RegisterRequest
        {
            UserName = userName,
            Email = email,
            Password = password
        });

        if (!response.IsSuccessStatusCode)
            return false;

        var result = await response.Content.ReadFromJsonAsync<AuthResponse>();
        if (result?.AccessToken == null)
            return false;

        await SecureStorage.Default.SetAsync(TokenKey, result.AccessToken);
        IsAuthenticated = true;
        return true;
    }

    public async Task LogoutAsync()
    {
        SecureStorage.Default.Remove(TokenKey);
        IsAuthenticated = false;
        await Shell.Current.GoToAsync("//login");
    }

    public async Task<string?> GetTokenAsync()
    {
        return await SecureStorage.Default.GetAsync(TokenKey);
    }

    public async Task<UserInfo?> GetUserInfoAsync()
    {
        var token = await GetTokenAsync();
        if (token == null) return null;

        // Decode JWT payload (base64url → JSON) without signature verification
        var parts = token.Split('.');
        if (parts.Length != 3) return null;

        var payload = parts[1];
        payload = (payload.Length % 4) switch
        {
            2 => payload + "==",
            3 => payload + "=",
            _ => payload
        };
        payload = payload.Replace('-', '+').Replace('_', '/');

        var json = Encoding.UTF8.GetString(Convert.FromBase64String(payload));
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        // ClaimTypes.Role serialises to its full URI in JWTs
        const string roleClaimKey =
            "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";

        return new UserInfo
        {
            Email = GetStringClaim(root, "email"),
            UserName = GetStringClaim(root, "email").Split('@')[0],
            Subscription = GetStringClaim(root, "subscription"),
            Role = GetStringClaim(root, roleClaimKey)
        };
    }

    private static string GetStringClaim(JsonElement root, string key)
    {
        if (!root.TryGetProperty(key, out var element))
            return string.Empty;

        return element.ValueKind == JsonValueKind.Array
            ? element.EnumerateArray().FirstOrDefault().GetString() ?? string.Empty
            : element.GetString() ?? string.Empty;
    }
}
