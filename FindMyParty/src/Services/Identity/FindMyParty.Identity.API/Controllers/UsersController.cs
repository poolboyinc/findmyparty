using FindMyParty.Identity.API.Application.DTOs;
using FindMyParty.Identity.API.Domain.Entities;
using FindMyParty.Identity.API.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace FindMyParty.Identity.API.Controllers
{
    [Authorize(Roles = "Admin")]
    [ApiController]
    [Route("api/users")]
    public class UsersController(UserManager<ApplicationUser> userManager) : ControllerBase
    {
        [HttpGet]
        public IActionResult GetAll([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            var users = userManager.Users
                .OrderBy(u => u.UserName)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(u => new
                {
                    u.Id,
                    u.UserName,
                    u.Email,
                    u.Subscription
                })
                .ToList();

            return Ok(users);
        }

        [HttpPost("{id}/roles")]
        public async Task<IActionResult> AssignRole(string id, [FromBody] AssignRoleRequest request)
        {
            // Host role requires a venue profile — use POST /api/hosts/{userId} to onboard a host
            if (request.Role == "Host")
                return BadRequest("Cannot assign the Host role directly. Use POST /api/hosts/{userId} to onboard a host with their venue profile.");

            var validRoles = new[] { "User", "Admin" };
            if (!validRoles.Contains(request.Role))
                return BadRequest($"Invalid role. Valid roles: {string.Join(", ", validRoles)}");

            var user = await userManager.FindByIdAsync(id);
            if (user is null)
                return NotFound();

            var result = await userManager.AddToRoleAsync(user, request.Role);
            if (!result.Succeeded)
                return BadRequest(result.Errors);

            return NoContent();
        }

        [HttpDelete("{id}/roles/{role}")]
        public async Task<IActionResult> RemoveRole(string id, string role)
        {
            var user = await userManager.FindByIdAsync(id);
            if (user is null)
                return NotFound();

            var result = await userManager.RemoveFromRoleAsync(user, role);
            if (!result.Succeeded)
                return BadRequest(result.Errors);

            return NoContent();
        }

        [HttpPut("{id}/subscription")]
        public async Task<IActionResult> UpdateSubscription(string id, [FromBody] UpdateSubscriptionRequest request)
        {
            if (!Enum.TryParse<SubscriptionType>(request.Subscription, ignoreCase: true, out var subscription))
                return BadRequest("Invalid subscription type. Valid values: Free, Premium");

            var user = await userManager.FindByIdAsync(id);
            if (user is null)
                return NotFound();

            user.Subscription = subscription;
            await userManager.UpdateAsync(user);

            return NoContent();
        }
    }
}
