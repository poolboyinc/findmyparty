using FindMyParty.Api.Cities;
using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using FindMyParty.Api.Parties;
using FindMyParty.Api.Storage;
using FindMyParty.Api.Venues;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Identity;

[Authorize]
[ApiController]
[Route("api/hosts")]
public class HostsController(AppDbContext db, UserManager<ApplicationUser> userManager, IImageStorage images) : ControllerBase
{
    /// <summary>Admin: makes a user a host and creates (or updates) their venue.</summary>
    [Authorize(Roles = Roles.Admin)]
    [HttpPost("{userId}")]
    public async Task<IActionResult> OnboardHost(string userId, [FromBody] SetVenueProfileRequest request)
    {
        var user = await userManager.FindByIdAsync(userId);
        if (user is null) return NotFound("User not found.");
        var city = await CityLookup.RequireAsync(db, request.City) ?? await CityLookup.NearestAsync(db, request.Latitude, request.Longitude);

        var alreadyHost = await userManager.IsInRoleAsync(user, Roles.Host);
        var profile = await db.VenueProfiles.FirstOrDefaultAsync(v => v.UserId == userId);
        if (alreadyHost && profile is not null) return Conflict("User is already a host.");

        await using var tx = await db.Database.BeginTransactionAsync();
        if (!alreadyHost)
        {
            var roleResult = await userManager.AddToRoleAsync(user, Roles.Host);
            if (!roleResult.Succeeded) return BadRequest(roleResult.Errors);
        }

        if (profile is null)
        {
            profile = new VenueProfile { Id = Guid.NewGuid(), UserId = userId };
            db.VenueProfiles.Add(profile);
        }
        Apply(profile, request, city);
        await db.SaveChangesAsync();
        await tx.CommitAsync();
        return NoContent();
    }

    /// <summary>Admin: updates a host's venue, including its location.</summary>
    [Authorize(Roles = Roles.Admin)]
    [HttpPut("{userId}/profile")]
    public async Task<IActionResult> UpdateProfile(string userId, [FromBody] SetVenueProfileRequest request)
    {
        var profile = await db.VenueProfiles.FirstOrDefaultAsync(v => v.UserId == userId);
        if (profile is null) return NotFound("No venue profile found for this user. Use POST /api/hosts/{userId} to onboard them first.");

        var city = await CityLookup.RequireAsync(db, request.City) ?? await CityLookup.NearestAsync(db, request.Latitude, request.Longitude);
        Apply(profile, request, city);
        await db.SaveChangesAsync();
        return NoContent();
    }

    private static void Apply(VenueProfile profile, SetVenueProfileRequest request, string city)
    {
        profile.VenueName = request.VenueName;
        profile.Address = request.Address;
        profile.Latitude = request.Latitude;
        profile.Longitude = request.Longitude;
        profile.CitySlug = city;
        if (request.Kind is not null) profile.Kind = Blank(request.Kind);
        if (request.Area is not null) profile.Area = Blank(request.Area);
    }

    private static string? Blank(string value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    [HttpGet("profile")]
    [Authorize(Roles = $"{Roles.Host},{Roles.Admin}")]
    public async Task<IActionResult> GetMyProfile()
    {
        var userId = User.UserIdString();
        var p = await db.VenueProfiles.AsNoTracking().FirstOrDefaultAsync(v => v.UserId == userId);
        if (p is null) return NotFound("Venue profile not found. Contact FindMyParty support.");

        var followers = await db.Set<VenueFollow>().CountAsync(f => f.VenueId == p.Id);
        return Ok(new VenueProfileDto(p.Id.ToString(), p.VenueName, p.Address, p.Latitude, p.Longitude, p.WorkingHoursOpen, p.WorkingHoursClose, p.WorkingDays,
            p.CitySlug, p.Kind, p.Area, p.ImageUrl, followers));
    }

    [HttpPatch("profile")]
    [Authorize(Roles = $"{Roles.Host},{Roles.Admin}")]
    public async Task<IActionResult> UpdateMyProfile([FromBody] UpdateMyVenueProfileRequest request)
    {
        var userId = User.UserIdString();
        var profile = await db.VenueProfiles.FirstOrDefaultAsync(v => v.UserId == userId);
        if (profile is null) return NotFound("Venue profile not found. Contact FindMyParty support.");

        profile.VenueName = request.VenueName;
        profile.WorkingHoursOpen = request.WorkingHoursOpen;
        profile.WorkingHoursClose = request.WorkingHoursClose;
        profile.WorkingDays = request.WorkingDays;
        if (request.Kind is not null) profile.Kind = Blank(request.Kind);
        if (request.Area is not null) profile.Area = Blank(request.Area);
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>The venue's artwork (S-11's header). Stored under a name the server chooses, with the type read from the bytes.</summary>
    [HttpPost("profile/image")]
    [Authorize(Roles = Roles.Host)]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<IActionResult> UploadImage(IFormFile file, CancellationToken ct)
    {
        var userId = User.UserIdString();
        var profile = await db.VenueProfiles.FirstOrDefaultAsync(v => v.UserId == userId, ct);
        if (profile is null) return NotFound("Venue profile not found. Contact FindMyParty support.");
        if (!images.IsConfigured) throw PartiesController.StorageOff();

        await using var stream = file.OpenReadStream();
        var kind = await ImageSniffer.DetectAsync(stream, ct);
        if (kind is null) return BadRequest("Only JPEG, PNG and WebP images are allowed.");

        var imageUrl = await images.UploadAsync(stream, $"venues/{profile.Id}/{Guid.NewGuid():N}{kind.Extension}", kind.ContentType, ct);
        profile.ImageUrl = imageUrl;
        await db.SaveChangesAsync(ct);
        return Ok(new { imageUrl });
    }
}
