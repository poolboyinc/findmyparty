using FindMyParty.Bookings.API.Application.Common;
using System.Security.Claims;

namespace FindMyParty.Bookings.API.Infrastructure.Services
{
    public class CurrentUserService( IHttpContextAccessor httpContextAccessor) : ICurrentUserService
    {
        public bool IsAuthenticated =>
            httpContextAccessor.HttpContext?.User?.Identity?.IsAuthenticated ?? false;

        public Guid UserId
        {
            get
            {
                var userId = httpContextAccessor.HttpContext?
                    .User?
                    .FindFirstValue(ClaimTypes.NameIdentifier)
                    ?? httpContextAccessor.HttpContext?
                    .User?
                    .FindFirstValue("sub");

                if (string.IsNullOrWhiteSpace(userId))
                    throw new UnauthorizedAccessException("User is not authenticated");

                return Guid.Parse(userId);
            }
        }
    }
}
