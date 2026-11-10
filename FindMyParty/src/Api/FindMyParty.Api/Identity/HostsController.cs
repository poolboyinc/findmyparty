using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Identity;

[Authorize]
[ApiController]
[Route("api/hosts")]
public class HostsController(AppDbContext db, UserManager<ApplicationUser> userManager) : ControllerBase
{
    /// <summary>Admin: makes a user a host and creates (or updates) their venue.</summary>
    [Authorize(Roles = Roles.Admin)]
    [HttpPost("{userId}")]
    public async Task<IActionResult> OnboardHost(string userId, [FromBody] SetVenueProfileRequest request)
    {
        var user = await userManager.FindByIdAsync(userId);
        if (user is null) return NotFound("User not found.");

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
        profile.VenueName = request.VenueName;
        profile.Address = request.Address;
        profile.Latitude = request.Latitude;
        profile.Longitude = request.Longitude;
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

        profile.VenueName = request.VenueName;
        profile.Address = request.Address;
        profile.Latitude = request.Latitude;
        profile.Longitude = request.Longitude;
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("profile")]
    [Authorize(Roles = $"{Roles.Host},{Roles.Admin}")]
    public async Task<IActionResult> GetMyProfile()
    {
        var userId = User.UserIdString();
        var p = await db.VenueProfiles.AsNoTracking().FirstOrDefaultAsync(v => v.UserId == userId);
        if (p is null) return NotFound("Venue profile not found. Contact FindMyParty support.");

        return Ok(new VenueProfileDto(p.Id.ToString(), p.VenueName, p.Address, p.Latitude, p.Longitude, p.WorkingHoursOpen, p.WorkingHoursClose, p.WorkingDays));
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
        await db.SaveChangesAsync();
        return NoContent();
    }
}
