using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Identity;

[Authorize(Roles = Roles.Admin)]
[ApiController]
[Route("api/users")]
public class UsersController(UserManager<ApplicationUser> userManager) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var users = await userManager.Users
            .OrderBy(u => u.UserName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new { u.Id, u.UserName, u.Email, u.Subscription })
            .ToListAsync();
        return Ok(users);
    }

    [HttpPost("{id}/roles")]
    public async Task<IActionResult> AssignRole(string id, [FromBody] AssignRoleRequest request)
    {
        if (request.Role == Roles.Host)
            return BadRequest("Cannot assign the Host role directly. Use POST /api/hosts/{userId} to onboard a host with their venue profile.");
        if (request.Role != Roles.User && request.Role != Roles.Admin)
            return BadRequest("Invalid role. Valid roles: User, Admin");

        var user = await userManager.FindByIdAsync(id);
        if (user is null) return NotFound();

        var result = await userManager.AddToRoleAsync(user, request.Role);
        return result.Succeeded ? NoContent() : BadRequest(result.Errors);
    }

    [HttpDelete("{id}/roles/{role}")]
    public async Task<IActionResult> RemoveRole(string id, string role)
    {
        var user = await userManager.FindByIdAsync(id);
        if (user is null) return NotFound();

        var result = await userManager.RemoveFromRoleAsync(user, role);
        return result.Succeeded ? NoContent() : BadRequest(result.Errors);
    }

    [HttpPut("{id}/subscription")]
    public async Task<IActionResult> UpdateSubscription(string id, [FromBody] UpdateSubscriptionRequest request)
    {
        if (!Enum.TryParse<SubscriptionType>(request.Subscription, ignoreCase: true, out var subscription))
            return BadRequest("Invalid subscription type. Valid values: Free, Premium");

        var user = await userManager.FindByIdAsync(id);
        if (user is null) return NotFound();

        user.Subscription = subscription;
        await userManager.UpdateAsync(user);
        return NoContent();
    }
}
