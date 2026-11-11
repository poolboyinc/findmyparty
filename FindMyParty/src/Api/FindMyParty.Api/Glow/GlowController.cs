using System.Globalization;
using FindMyParty.Api.Common;
using FindMyParty.Api.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FindMyParty.Api.Glow;

/// <summary>The guest's Glow: standing, the award of one scan, perks and claims, nights and their recaps, who invited them.</summary>
[Authorize]
[ApiController]
[Route("api")]
public class GlowController(GlowService glow, PerkService perks, RecapService recaps, TimeProvider time) : ControllerBase
{
    private DateTime Now => time.GetUtcNow().UtcDateTime;

    [HttpGet("me/glow")]
    public async Task<ActionResult<GlowSummary>> Summary(CancellationToken ct) =>
        await glow.SummaryAsync(User.UserId(), Now, ct);

    /// <summary>What one scan paid. 404 until the scan has been paid (the phone retries).</summary>
    [HttpGet("me/glow/awards")]
    public async Task<ActionResult<GlowAward>> Award([FromQuery] Guid bookingId, CancellationToken ct) =>
        await glow.AwardForAsync(User.UserId(), bookingId, ct) ?? throw ApiException.NotFound("Award");

    [HttpGet("me/perks")]
    public async Task<ActionResult<List<PerkItem>>> Perks([FromQuery] string? city, CancellationToken ct) =>
        await perks.ListAsync(User.UserId(), city, Now, ct);

    [HttpGet("perks/{id:guid}")]
    public async Task<ActionResult<PerkItem>> Perk(Guid id, CancellationToken ct) =>
        await perks.GetAsync(User.UserId(), id, Now, ct);

    [HttpPost("perks/{id:guid}/claim")]
    public async Task<ActionResult<PerkClaimDto>> Claim(Guid id, CancellationToken ct) =>
        await perks.ClaimAsync(User.UserId(), id, Now, ct);

    [HttpGet("me/nights")]
    public async Task<ActionResult<List<NightSummary>>> Nights([FromQuery] int take = 20, CancellationToken ct = default) =>
        await recaps.NightsAsync(User.UserId(), take, ct);

    [HttpGet("me/nights/{date}")]
    public async Task<ActionResult<NightRecap>> Night(string date, CancellationToken ct)
    {
        var night = ParseNight(date);
        var userId = User.UserId();
        var token = await recaps.ShareTokenAsync(userId, night, ct);
        return await recaps.RecapAsync(userId, night, token is null ? null : ShareUrl(token), ct) ?? throw ApiException.NotFound("Night");
    }

    [HttpPost("me/nights/{date}/share")]
    public async Task<ActionResult<ShareUrlResponse>> Share(string date, CancellationToken ct)
    {
        var token = await recaps.ShareAsync(User.UserId(), ParseNight(date), Now, ct) ?? throw ApiException.NotFound("Night");
        return new ShareUrlResponse(ShareUrl(token));
    }

    [HttpDelete("me/nights/{date}/share")]
    public async Task<IActionResult> Unshare(string date, CancellationToken ct)
    {
        await recaps.UnshareAsync(User.UserId(), ParseNight(date), ct);
        return NoContent();
    }

    [HttpPost("me/referrer")]
    public async Task<IActionResult> Referrer([FromBody] SetReferrerRequest request, CancellationToken ct)
    {
        await glow.SetReferrerAsync(User.UserId(), request.Handle, Now, ct);
        return NoContent();
    }

    private string ShareUrl(string token) => Links.PublicUrl(HttpContext, $"/r/{token}");

    private static DateOnly ParseNight(string date) =>
        DateOnly.TryParseExact(date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var night)
            ? night
            : throw ApiException.Invalid("A night is a date like 2026-11-13.");
}

/// <summary>A shared recap, for anyone with the link.</summary>
[ApiController]
[Route("api/recaps")]
public class RecapsController(RecapService recaps) : ControllerBase
{
    [HttpGet("{token}")]
    public async Task<ActionResult<NightRecap>> Get(string token, CancellationToken ct)
    {
        var share = await recaps.ByTokenAsync(token, ct) ?? throw ApiException.NotFound("Recap");
        return await recaps.RecapAsync(share.UserId, share.Night, Links.PublicUrl(HttpContext, $"/r/{token}"), ct)
               ?? throw ApiException.NotFound("Recap");
    }
}

/// <summary>The three level perks a host switches on for their venue.</summary>
[Authorize(Roles = Roles.Host)]
[ApiController]
[Route("api/hosts/perks")]
public class HostPerksController(PerkService perks, TimeProvider time) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<HostPerk>>> Get(CancellationToken ct) => await perks.HostPerksAsync(User.UserId(), ct);

    [HttpPut("{kind}")]
    public async Task<IActionResult> Set(string kind, [FromBody] SetHostPerkRequest request, CancellationToken ct)
    {
        await perks.SetHostPerkAsync(User.UserId(), kind, request, time.GetUtcNow().UtcDateTime, ct);
        return NoContent();
    }
}

/// <summary>Sponsored perks, made by the platform admin (no screen; the demo seed and these endpoints).</summary>
[Authorize(Roles = Roles.Admin)]
[ApiController]
[Route("api/admin/perks")]
public class AdminPerksController(PerkService perks, TimeProvider time) : ControllerBase
{
    private DateTime Now => time.GetUtcNow().UtcDateTime;

    [HttpGet]
    public async Task<ActionResult<List<PerkItem>>> Get(CancellationToken ct) => await perks.AdminListAsync(User.UserId(), Now, ct);

    [HttpPost]
    public async Task<ActionResult<PerkItem>> Create([FromBody] SponsoredPerkInput input, CancellationToken ct) =>
        await perks.CreateSponsoredAsync(User.UserId(), input, Now, ct);

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> SwitchOff(Guid id, CancellationToken ct)
    {
        await perks.SwitchOffAsync(id, ct);
        return NoContent();
    }
}

/// <summary>The door redeems a claim code (a `fmpc1` QR).</summary>
[Authorize(Roles = $"{Roles.Host},{Roles.Door}")]
[ApiController]
[Route("api/perk-claims")]
public class PerkClaimsController(PerkService perks, TimeProvider time) : ControllerBase
{
    [HttpPost("redeem")]
    public async Task<ActionResult<RedeemResult>> Redeem([FromBody] RedeemRequest request, CancellationToken ct) =>
        await perks.RedeemAsync(User.UserId(), request.Code, time.GetUtcNow().UtcDateTime, ct);
}
