namespace FindMyParty.Bookings.API.Application.IntegrationEvents
{
    public record BookingCancelledIntegrationEvent(
        Guid BookingId,
        Guid PartyId,
        Guid UserId,
        int TicketCount
    );
}
