using FindMyParty.Identity.API.Application.DTOs;
using FindMyParty.Identity.API.Domain.Entities;
using FindMyParty.Identity.API.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace FindMyParty.Identity.API.Controllers
{
    [Authorize(Roles = "Admin")]
    [ApiController]
    [Route("api/hosts")]
    public class HostsController(IdentityDbContext db, UserManager<ApplicationUser> userManager) : ControllerBase
    {
        /// <summary>
        /// Onboards an existing user as a host.
        /// Assigns the Host role and creates their venue profile atomically.
        /// A host cannot exist without a venue profile — this is the only way to make someone a host.
        /// </summary>
        [HttpPost("{userId}")]
        public async Task<IActionResult> OnboardHost(string userId, [FromBody] SetVenueProfileRequest request)
        {
            var user = await userManager.FindByIdAsync(userId);
            if (user is null)
                return NotFound("User not found.");

            var alreadyHost = await userManager.IsInRoleAsync(user, "Host");
            if (alreadyHost)
                return Conflict("User is already a host.");

            // Assign Host role
            var roleResult = await userManager.AddToRoleAsync(user, "Host");
            if (!roleResult.Succeeded)
                return BadRequest(roleResult.Errors);

            // Create venue profile — if this fails, roll back the role assignment
            try
            {
                db.VenueProfiles.Add(new VenueProfile
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    VenueName = request.VenueName,
                    Address = request.Address,
                    Latitude = request.Latitude,
                    Longitude = request.Longitude
                });

                await db.SaveChangesAsync();
            }
            catch
            {
                await userManager.RemoveFromRoleAsync(user, "Host");
                throw;
            }

            return NoContent();
        }

        /// <summary>
        /// Updates the venue profile for an existing host.
        /// Use this when a venue moves location or changes its name.
        /// </summary>
        [HttpPut("{userId}/profile")]
        public async Task<IActionResult> UpdateProfile(string userId, [FromBody] SetVenueProfileRequest request)
        {
            var profile = await db.VenueProfiles
                .FirstOrDefaultAsync(v => v.UserId == userId);

            if (profile is null)
                return NotFound("No venue profile found for this user. Use POST /api/hosts/{userId} to onboard them first.");

            profile.VenueName = request.VenueName;
            profile.Address = request.Address;
            profile.Latitude = request.Latitude;
            profile.Longitude = request.Longitude;

            await db.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>
        /// Returns the venue profile for the currently authenticated host.
        /// Called by the mobile admin portal to silently populate party coordinates.
        /// </summary>
        [HttpGet("profile")]
        [Authorize(Roles = "Host,Admin")]
        public async Task<IActionResult> GetMyProfile()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId is null)
                return Unauthorized();

            var profile = await db.VenueProfiles
                .AsNoTracking()
                .FirstOrDefaultAsync(v => v.UserId == userId);

            if (profile is null)
                return NotFound("Venue profile not found. Contact FindMyParty support.");

            return Ok(new VenueProfileDto(
                profile.Id.ToString(),
                profile.VenueName,
                profile.Address,
                profile.Latitude,
                profile.Longitude));
        }
    }
}
