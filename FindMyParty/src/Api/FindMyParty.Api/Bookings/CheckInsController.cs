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
    /// <summary>Look at a scanned pass without letting anyone in yet: who it is, how many are still outside.</summary>
    [HttpPost("preview")]
    public async Task<IActionResult> Preview([FromBody] CheckInRequest request, CancellationToken ct) =>
        Ok(await passes.PreviewAsync(User.UserId(), request.Code, ct));

    /// <summary>Scan a pass at the door. `code` is the text in the QR; `admit` lets in part of a group.</summary>
    [HttpPost]
    public async Task<IActionResult> Scan([FromBody] CheckInRequest request, CancellationToken ct) =>
        Ok(await passes.CheckInAsync(User.UserId(), request.Code, request.Admit, ct));
}
