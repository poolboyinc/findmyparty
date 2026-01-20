namespace FindMyParty.Bookings.API.Application.Commands
{
    public record CreateBookingCommand(
        Guid UserId,
        Guid PartyId,
        int TicketCount
    );
}
