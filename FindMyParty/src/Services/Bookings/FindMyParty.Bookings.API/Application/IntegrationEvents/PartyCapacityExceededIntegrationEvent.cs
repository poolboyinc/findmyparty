namespace FindMyParty.Bookings.API.Application.IntegrationEvents
{
    public record PartyCapacityExceededIntegrationEvent(
        Guid BookingId,
        Guid PartyId
    );
}
