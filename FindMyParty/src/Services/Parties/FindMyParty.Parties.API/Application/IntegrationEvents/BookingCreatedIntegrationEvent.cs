namespace FindMyParty.Parties.API.Application.Integration_Events
{
    public record BookingCreatedIntegrationEvent
        (
        Guid BookingId,
        Guid PartyId,
        Guid UserId,
        int TicketCount
        );
}
public record BookingCreatedIntegrationEvent(
    Guid BookingId,
    Guid PartyId,
    int TicketCount
);