namespace FindMyParty.Bookings.API.Application.Commands
{
    public record CreateBookingCommand(
        Guid PartyId,
        int TicketCount,
        string IdempotencyKey
    );
}
