using FindMyParty.Api.Common;
using FindMyParty.Api.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FindMyParty.Api.Bookings;

/// <summary>The door: the venue's host or one of its door logins.</summary>
[Authorize(Roles = Roles.Host + "," + Roles.Door)]
[ApiController]
[Route("api/checkins")]
public class CheckInsController(PassService passes) : ControllerBase
{
    /// <summary>Look at a scanned pass without letting anyone in yet: who it is, how many are still outside, what to collect.</summary>
    [HttpPost("preview")]
    public async Task<IActionResult> Preview([FromBody] CheckInRequest request, CancellationToken ct) =>
        Ok(await passes.PreviewAsync(User.UserId(), request.Code, ct));

    /// <summary>Scan a pass at the door. `code` is the text in the QR; `admit` lets in part of a group; `clientScanId` makes a retry safe.</summary>
    [HttpPost]
    public async Task<IActionResult> Scan([FromBody] CheckInRequest request, CancellationToken ct) =>
        Ok(await passes.CheckInAsync(User.UserId(), request.Code, request.Admit, request.ClientScanId, null, ct));

    /// <summary>Scans made with no signal, replayed at the moment each was made.</summary>
    [HttpPost("batch")]
    public async Task<IActionResult> Batch([FromBody] BatchScanRequest request, CancellationToken ct) =>
        Ok(await passes.CheckInBatchAsync(User.UserId(), request.Items, ct));
}
