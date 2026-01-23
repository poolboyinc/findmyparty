namespace FindMyParty.Bookings.API.Infrastructure.Services
{
    public interface IPartyAvailabilityService
    {
        Task<PartyAvailabilityResult> CheckAvailabilityAsync(
            Guid partyId,
            int requestedTickets);
    }

    public record PartyAvailabilityResult(
        bool IsAvailable,
        int RemainingCapacity,
        decimal PricePerTicket);
}
