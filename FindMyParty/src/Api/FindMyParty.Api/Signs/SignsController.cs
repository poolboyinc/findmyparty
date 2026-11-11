using FindMyParty.Api.Cities;
using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using FindMyParty.Api.Identity;
using FindMyParty.Api.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Signs;

/// <summary>Signs on the map (anyone), hiding one (a signed-in viewer), and booking them (a host).</summary>
[ApiController]
public class SignsController(SignService signs, IImageStorage images, AppDbContext db) : ControllerBase
{
    /// <summary>The signs up in a city today. Works signed out; a signed-in viewer does not get the ones they hid.</summary>
    [HttpGet("api/signs")]
    public async Task<List<MapSign>> Map([FromQuery] string? city, CancellationToken ct)
    {
        var viewer = User.OptionalUserId();
        if (string.IsNullOrWhiteSpace(city))
        {
            var key = viewer?.ToString();
            city = key is null ? null : await db.Users.Where(u => u.Id == key).Select(u => u.HomeCity).FirstOrDefaultAsync(ct);
            if (!City.All.Any(c => c.Slug == city)) city = City.Default;
        }
        else if (!City.All.Any(c => c.Slug == city))
            throw ApiException.Invalid("That city is not on FindMyParty yet.", "city_unknown");
        return await signs.MapAsync(viewer, city!, ct);
    }

    [Authorize]
    [HttpPost("api/signs/{id:guid}/hide")]
    public async Task<IActionResult> Hide(Guid id, CancellationToken ct)
    {
        await signs.HideAsync(User.UserId(), id, ct);
        return NoContent();
    }

    [Authorize(Roles = Roles.Host)]
    [HttpGet("api/hosts/signs/options")]
    public Task<SignOptions> Options([FromQuery] string? week, CancellationToken ct) => signs.OptionsAsync(User.UserId(), week, ct);

    [Authorize(Roles = Roles.Host)]
    [HttpPost("api/hosts/signs")]
    public Task<SignBookingDto> Book([FromBody] SignInput input, CancellationToken ct) =>
        signs.BookAsync(User.UserId(), input with { AdvertiserName = null, VenueId = null, PerkId = null, CardTitle = null, CardSubtitle = null }, ct);

    /// <summary>The sign's own picture. Without storage it answers storage_off; the sign still books with text and colours.</summary>
    [Authorize(Roles = Roles.Host)]
    [HttpPost("api/hosts/signs/artwork")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<IActionResult> Artwork(IFormFile file, CancellationToken ct)
    {
        if (!images.IsConfigured)
            throw new ApiException(StatusCodes.Status503ServiceUnavailable, "Images cannot be uploaded yet. Everything else was saved.", "storage_off");
        await using var stream = file.OpenReadStream();
        var kind = await ImageSniffer.DetectAsync(stream, ct) ?? throw ApiException.Invalid("Only JPEG, PNG and WebP images are allowed.");
        var artworkUrl = await images.UploadAsync(stream, $"signs/{User.UserId():N}/{Guid.NewGuid():N}{kind.Extension}", kind.ContentType, ct);
        return Ok(new { artworkUrl });
    }

    [Authorize(Roles = Roles.Host)]
    [HttpDelete("api/hosts/signs/{id:guid}")]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
    {
        await signs.CancelAsync(User.UserId(), id, ct);
        return NoContent();
    }
}

/// <summary>The platform admin: reviewing signs, brand signs, invoices and the spots themselves.</summary>
[ApiController]
[Authorize(Roles = Roles.Admin)]
[Route("api/admin")]
public class AdminSignsController(SignService signs) : ControllerBase
{
    [HttpGet("signs")]
    public Task<List<AdminSignDto>> List([FromQuery] string? status, CancellationToken ct) => signs.AdminListAsync(status, ct);

    [HttpPost("signs")]
    public Task<SignBookingDto> Book([FromBody] SignInput input, CancellationToken ct) => signs.AdminBookAsync(User.UserId(), input, ct);

    [HttpPost("signs/{id:guid}/approve")]
    public async Task<IActionResult> Approve(Guid id, CancellationToken ct)
    {
        await signs.ApproveAsync(User.UserId(), id, ct);
        return NoContent();
    }

    [HttpPost("signs/{id:guid}/reject")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] RejectInput input, CancellationToken ct)
    {
        await signs.RejectAsync(User.UserId(), id, input.Note, ct);
        return NoContent();
    }

    [HttpPost("signs/{id:guid}/invoiced")]
    public async Task<IActionResult> Invoiced(Guid id, CancellationToken ct)
    {
        await signs.InvoicedAsync(id, ct);
        return NoContent();
    }

    [HttpGet("sign-spots")]
    public Task<List<SignSpotDto>> Spots(CancellationToken ct) => signs.SpotsAsync(ct);

    [HttpPost("sign-spots")]
    public Task<SignSpotDto> AddSpot([FromBody] SignSpotInput input, CancellationToken ct) => signs.SaveSpotAsync(null, input, ct);

    [HttpPut("sign-spots/{id:guid}")]
    public Task<SignSpotDto> EditSpot(Guid id, [FromBody] SignSpotInput input, CancellationToken ct) => signs.SaveSpotAsync(id, input, ct);
}
