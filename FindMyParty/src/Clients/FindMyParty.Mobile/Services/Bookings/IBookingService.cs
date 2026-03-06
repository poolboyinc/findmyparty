using FindMyParty.Mobile.Models.Bookings;

namespace FindMyParty.Mobile.Services.Bookings;

public interface IBookingService
{
    Task<bool> CreateBookingAsync(Guid partyId, int ticketCount);
    Task<List<BookingItem>> GetMyBookingsAsync();
}
