using FindMyParty.Api.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FindMyParty.Api.Bookings;

[Authorize]
[ApiController]
[Route("api/guest-passes")]
public class GuestPassesController(GuestPassService guestPasses, PassService passes) : ControllerBase
{
    /// <summary>What a shared link shows before anyone signs in.</summary>
    [AllowAnonymous]
    [HttpGet("preview/{token}")]
    public async Task<IActionResult> Preview(string token, CancellationToken ct) => Ok(await guestPasses.PreviewAsync(token, ct));

    /// <summary>Take a guest pass someone sent. Answers with the guest's row of "my bookings".</summary>
    [HttpPost("claim")]
    public async Task<IActionResult> Claim([FromBody] ClaimGuestPassRequest request, CancellationToken ct) =>
        Ok(await guestPasses.ClaimAsync(User.UserId(), request.Token, ct));

    /// <summary>The booker takes it back, or the guest gives it back.</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Revoke(Guid id, CancellationToken ct)
    {
        await guestPasses.RevokeAsync(User.UserId(), id, ct);
        return NoContent();
    }

    /// <summary>The guest's own pass: their code, worth one spot.</summary>
    [HttpGet("{id:guid}/pass")]
    public async Task<IActionResult> GetPass(Guid id, CancellationToken ct) => Ok(await passes.GetGuestPassAsync(User.UserId(), id, ct));
}
