using FindMyParty.Mobile.Models.Auth;

namespace FindMyParty.Mobile.Services.Auth;

public interface IAuthService
{
    bool IsAuthenticated { get; }
    Task<bool> LoginAsync(string email, string password);
    Task<bool> RegisterAsync(string userName, string email, string password);
    Task LogoutAsync();
    Task<string?> GetTokenAsync();
    Task<UserInfo?> GetUserInfoAsync();
}
