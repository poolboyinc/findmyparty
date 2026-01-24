using FindMyParty.Bookings.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Bookings.API.Application.IntegrationEvents.Handlers
{
    public class PartyCapacityExceededIntegrationEventHandler ( BookingsDbContext db)
    {
        public async Task Handle(PartyCapacityExceededIntegrationEvent @event)
        {
            var booking = await db.Bookings
                .FirstOrDefaultAsync(b => b.Id == @event.BookingId);

            if (booking == null)
                return;

            booking.Cancel();
            await db.SaveChangesAsync();
        }
    }
}
