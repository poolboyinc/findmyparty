using FindMyParty.Api.Common;
using FindMyParty.Api.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FindMyParty.Api.Bookings;

[Authorize(Roles = Roles.Host)]
[ApiController]
[Route("api/checkins")]
public class CheckInsController(PassService passes) : ControllerBase
{
    /// <summary>Scan a pass at the door. `code` is the text in the QR; `admit` lets in part of a group.</summary>
    [HttpPost]
    public async Task<IActionResult> Scan([FromBody] CheckInRequest request, CancellationToken ct) =>
        Ok(await passes.CheckInAsync(User.UserId(), request.Code, request.Admit, ct));
}
