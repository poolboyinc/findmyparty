namespace FindMyParty.Bookings.API.Application.IntegrationEvents.Events
{
    public record PartyCapacityExceededIntegrationEvent(
        Guid BookingId,
        Guid PartyId
    );
}
