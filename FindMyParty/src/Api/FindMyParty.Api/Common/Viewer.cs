using System.Security.Claims;

namespace FindMyParty.Api.Common;

public static class Viewer
{
    /// <summary>Who is looking, on endpoints that also work signed out. Null when no valid token was sent.</summary>
    public static Guid? OptionalUserId(this ClaimsPrincipal user) =>
        user.Identity?.IsAuthenticated == true
        && Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub"), out var id)
            ? id
            : null;
}
