using System.Security.Claims;

namespace FindMyParty.Api.Common;

public static class CurrentUser
{
    /// <summary>The signed-in user's id as stored by ASP.NET Identity (a GUID string).</summary>
    public static string UserIdString(this ClaimsPrincipal user) =>
        user.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? user.FindFirstValue("sub")
        ?? throw new ApiException(StatusCodes.Status401Unauthorized, "Sign in first.", "unauthenticated");

    public static Guid UserId(this ClaimsPrincipal user) => Guid.Parse(user.UserIdString());
}
