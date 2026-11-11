using FindMyParty.Api.Common;
using FindMyParty.Api.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FindMyParty.Api.Door;

[Authorize(Roles = Roles.Host + "," + Roles.Door)]
[ApiController]
[Route("api/door")]
public class DoorController(DoorService door) : ControllerBase
{
    /// <summary>Which venue and door this scanner is, and the party on now with its in/capacity count.</summary>
    [HttpGet("context")]
    public async Task<IActionResult> Context(CancellationToken ct) => Ok(await door.ContextAsync(User.UserId(), ct));

    /// <summary>Tonight's list, kept on the door phone for when the signal drops.</summary>
    [HttpGet("manifest")]
    public async Task<IActionResult> Manifest([FromQuery] Guid partyId, CancellationToken ct) => Ok(await door.ManifestAsync(User.UserId(), partyId, ct));
}

[Authorize(Roles = Roles.Host)]
[ApiController]
[Route("api/hosts/door-staff")]
public class DoorStaffController(DoorStaffService staff) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct) => Ok(await staff.ListAsync(User.UserId(), ct));

    /// <summary>A new door login. Its password is in this answer only.</summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] DoorStaffRequest request, CancellationToken ct) =>
        Ok(await staff.CreateAsync(User.UserId(), request.Name, request.DoorName, ct));

    [HttpPost("{id:guid}/reset-password")]
    public async Task<IActionResult> ResetPassword(Guid id, CancellationToken ct) => Ok(await staff.ResetPasswordAsync(User.UserId(), id, ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Remove(Guid id, CancellationToken ct)
    {
        await staff.RemoveAsync(User.UserId(), id, ct);
        return NoContent();
    }
}
