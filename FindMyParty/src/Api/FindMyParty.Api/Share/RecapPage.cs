using FindMyParty.Api.Common;
using FindMyParty.Api.Glow;
using Microsoft.AspNetCore.Mvc;

namespace FindMyParty.Api.Share;

/// <summary>/r/{token}: the page behind a shared night recap. Venues and numbers only, never times or who else was there.</summary>
[ApiController]
public class RecapPage(RecapService recaps, SharePage share) : ControllerBase
{
    [HttpGet("/r/{token}")]
    public async Task<IActionResult> Get(string token, CancellationToken ct)
    {
        if (await recaps.ByTokenAsync(token, ct) is not { } found
            || await recaps.RecapAsync(found.UserId, found.Night, null, ct) is not { } recap)
            return SharePage.Result(share.NotFound(), StatusCodes.Status404NotFound);

        var description = $"{recap.Headline.Replace('\n', ' ')} +{GlowRules.Points(recap.Glow)} Glow";
        return SharePage.Result(share.Render($"@{recap.Handle}'s night", description,
            Links.PublicUrl(HttpContext, "/og.png"), $"recap/{token}"));
    }
}
