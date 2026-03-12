using FindMyParty.Bookings.API.Application.Commands;
using FindMyParty.Bookings.API.Application.DTOs;
using FindMyParty.Bookings.API.Application.Handlers;
using FindMyParty.Bookings.API.Application.Queries;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FindMyParty.Bookings.API.Controllers;

[Authorize]
[ApiController]
[Route("api/bookings")]
public class BookingsController(
    CreateBookingCommandHandler createHandler,
    CancelBookingCommandHandler cancelHandler,
    ConfirmBookingCommandHandler confirmHandler,
    GetUserBookingsQueryHandler queryHandler,
    GetPartyBookingsQueryHandler partyBookingsHandler) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Create(
        [FromBody] CreateBookingRequest request,
        [FromHeader(Name = "Idempotency-Key")] string idempotencyKey)
    {
        if (string.IsNullOrWhiteSpace(idempotencyKey))
            return BadRequest("Missing Idempotency-Key header");

        var bookingId = await createHandler.Handle(
            new CreateBookingCommand(request.PartyId, request.TicketCount, idempotencyKey));

        return Ok(new { BookingId = bookingId });
    }

    [HttpGet("my")]
    public async Task<IActionResult> GetMine()
    {
        var bookings = await queryHandler.Handle(new GetUserBookingsQuery());
        return Ok(bookings);
    }

    [HttpDelete("{bookingId:guid}")]
    public async Task<IActionResult> Cancel(Guid bookingId)
    {
        await cancelHandler.Handle(new CancelBookingCommand(bookingId));
        return NoContent();
    }

    [HttpPost("{bookingId:guid}/confirm")]
    public async Task<IActionResult> Confirm(Guid bookingId)
    {
        await confirmHandler.Handle(new ConfirmBookingCommand(bookingId));
        return NoContent();
    }

    [Authorize(Roles = "Host")]
    [HttpGet("party/{partyId:guid}")]
    public async Task<IActionResult> GetPartyBookings(Guid partyId)
    {
        var bookings = await partyBookingsHandler.Handle(new GetPartyBookingsQuery(partyId));
        return Ok(bookings);
    }
}
