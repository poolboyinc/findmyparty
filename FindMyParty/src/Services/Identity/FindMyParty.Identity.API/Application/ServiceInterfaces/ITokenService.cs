using FindMyParty.Identity.API.Domain.Entities;

namespace FindMyParty.Identity.API.Application.Services
{
    public interface ITokenService
    {
        Task<string> CreateAccessTokenAsync(ApplicationUser user);
    }
}
