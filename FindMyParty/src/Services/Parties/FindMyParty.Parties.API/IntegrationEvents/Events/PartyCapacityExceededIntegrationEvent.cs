namespace FindMyParty.Parties.API.IntegrationEvents.Events
{
    public record PartyCapacityExceededIntegrationEvent(
        Guid BookingId,
        Guid PartyId
    );
}
