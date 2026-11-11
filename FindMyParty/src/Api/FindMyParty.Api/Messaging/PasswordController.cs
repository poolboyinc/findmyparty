using FindMyParty.Api.Common;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace FindMyParty.Api.Messaging;

public record ForgotPasswordRequest(string? Email);
public record ResetPasswordRequest(string? Token, string? NewPassword);

/// <summary>"Forgot password": the mail, the page behind its link, and the reset itself.</summary>
[ApiController]
public class PasswordController(PasswordResetService resets, SharePage share) : ControllerBase
{
    /// <summary>Always 204, whether or not the account exists.</summary>
    [HttpPost("api/auth/forgot-password")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Forgot(ForgotPasswordRequest request, CancellationToken ct)
    {
        await resets.RequestAsync(request.Email, token => Links.PublicUrl(HttpContext, $"/reset?token={Uri.EscapeDataString(token)}"), ct);
        return NoContent();
    }

    /// <summary>`400 reset_invalid`, `400 password_weak` (reasons in `errors`).</summary>
    [HttpPost("api/auth/reset-password")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Reset(ResetPasswordRequest request, CancellationToken ct)
    {
        await resets.ResetAsync(request.Token, request.NewPassword, ct);
        return NoContent();
    }

    /// <summary>The page the mail links to: opens the app's reset screen with the token.</summary>
    [HttpGet("/reset")]
    public IActionResult Page([FromQuery] string? token)
    {
        if (string.IsNullOrWhiteSpace(token)) return SharePage.Result(share.NotFound(), StatusCodes.Status404NotFound);
        Response.Headers.CacheControl = "no-store";
        Response.Headers["Referrer-Policy"] = "no-referrer";
        return SharePage.Result(share.Render(
            "Reset your password",
            "Choose a new password in FindMyParty. The link works once, for two hours.",
            null,
            $"reset-password?token={Uri.EscapeDataString(token.Trim())}"));
    }
}
