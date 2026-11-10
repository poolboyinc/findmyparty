using FindMyParty.Api.Common;
using FindMyParty.Api.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FindMyParty.Api.Bookings;

[Authorize]
[ApiController]
[Route("api/bookings")]
public class BookingsController(BookingService bookings, PassService passes) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateBookingRequest request,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(idempotencyKey)) return BadRequest("Missing Idempotency-Key header");
        var bookingId = await bookings.CreateAsync(User.UserId(), request.PartyId, request.TicketCount, idempotencyKey, ct);
        return Ok(new { BookingId = bookingId });
    }

    [HttpGet("my")]
    public async Task<IActionResult> GetMine(CancellationToken ct) => Ok(await bookings.ForUserAsync(User.UserId(), ct));

    /// <summary>What the guest's phone needs to draw the pass and keep its door code changing, even offline.</summary>
    [HttpGet("{bookingId:guid}/pass")]
    public async Task<IActionResult> GetPass(Guid bookingId, CancellationToken ct) => Ok(await passes.GetPassAsync(User.UserId(), bookingId, ct));

    [HttpDelete("{bookingId:guid}")]
    public async Task<IActionResult> Cancel(Guid bookingId, CancellationToken ct)
    {
        await bookings.CancelAsync(User.UserId(), bookingId, ct);
        return NoContent();
    }

    [Authorize(Roles = Roles.Host)]
    [HttpPost("{bookingId:guid}/confirm")]
    public async Task<IActionResult> Confirm(Guid bookingId, CancellationToken ct)
    {
        await bookings.ConfirmAsync(User.UserId(), bookingId, ct);
        return NoContent();
    }

    [Authorize(Roles = Roles.Host)]
    [HttpGet("party/{partyId:guid}")]
    public async Task<IActionResult> GetPartyBookings(Guid partyId, CancellationToken ct) =>
        Ok(await bookings.ForPartyAsync(User.UserId(), partyId, ct));
}
