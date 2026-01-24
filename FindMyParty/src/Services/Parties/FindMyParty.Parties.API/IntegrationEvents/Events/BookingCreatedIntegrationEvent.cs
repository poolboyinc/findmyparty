namespace FindMyParty.Parties.API.IntegrationEvents.Events
{
    public record BookingCreatedIntegrationEvent(
        Guid BookingId,
        Guid PartyId,
        int TicketCount
    );
}
