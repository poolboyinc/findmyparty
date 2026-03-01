using FindMyParty.Bookings.API.Application.Commands;
using FindMyParty.Bookings.API.Application.Handlers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Reflection.Metadata;




namespace FindMyParty.Bookings.API.Controllers
{
    [ApiController]
    [Route("api/bookings")]
    public class BookingsController(CreateBookingCommandHandler handler) : ControllerBase
    {
        //[Authorize(Roles = "Host")]
        [HttpPost]
        public async Task<IActionResult> Create(
            CreateBookingRequest request,
            [FromHeader(Name = "Idempotency-Key")] string idempotencyKey)
        {
            if (string.IsNullOrWhiteSpace(idempotencyKey))
                return BadRequest("Missing Idempotency-Key header");

            var command = new CreateBookingCommand(
                request.PartyId,
                request.TicketCount,
                idempotencyKey);

            var bookingId = await handler.Handle(command);

            return Ok(new { BookingId = bookingId });
        }

    }
}