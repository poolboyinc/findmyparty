namespace FindMyParty.Parties.API.Application.IntegrationEvents
{
    public record BookingCreatedIntegrationEvent
        (
        Guid BookingId,
        Guid PartyId,
        Guid UserId,
        int TicketCount
        );
}