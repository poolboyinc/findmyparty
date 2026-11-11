using FindMyParty.Api.Bookings;
using FindMyParty.Api.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FindMyParty.Api.Share;

/// <summary>/g/{token}: the page behind a guest pass link. Opens guest-pass/{token} in the app.</summary>
[AllowAnonymous]
[ApiController]
[ApiExplorerSettings(IgnoreApi = true)]
public class GuestPassPage(GuestPassService guestPasses, SharePage share) : ControllerBase
{
    [HttpGet("/g/{token}")]
    public async Task<IActionResult> Get(string token, CancellationToken ct)
    {
        if (await guestPasses.ShareAsync(token, ct) is not { } pass) return SharePage.Result(share.NotFound(), StatusCodes.Status404NotFound);
        var image = string.IsNullOrWhiteSpace(pass.ImageUrl) ? Links.PublicUrl(HttpContext, "/og.png") : pass.ImageUrl;
        var description = pass.VenueName is null ? pass.PartyTitle : $"{pass.PartyTitle} at {pass.VenueName}";
        return SharePage.Result(share.Render($"{pass.Sender} sent you a pass", description, image, $"guest-pass/{token.Trim().ToLowerInvariant()}"));
    }
}
