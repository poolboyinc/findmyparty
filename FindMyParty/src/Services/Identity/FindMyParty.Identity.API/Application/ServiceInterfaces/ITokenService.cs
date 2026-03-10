using FindMyParty.Identity.API.Domain.Entities;

namespace FindMyParty.Identity.API.Application.Services
{
    public interface ITokenService
    {
        Task<string> CreateAccessTokenAsync(ApplicationUser user);
        Task<string> CreateRefreshTokenAsync(ApplicationUser user);
        Task<(bool isValid, ApplicationUser? user)> ValidateRefreshTokenAsync(string userId, string refreshToken);
    }
}
