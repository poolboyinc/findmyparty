using FindMyParty.Bookings.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Bookings.API.Application.IntegrationEvents.Handlers;

public class PartyCancelledIntegrationEventHandler(BookingsDbContext db)
{
    public async Task Handle(PartyCancelledIntegrationEvent @event, CancellationToken cancellationToken)
    {
        var activeBookings = await db.Bookings
            .Where(b => b.PartyId == @event.PartyId &&
                        b.Status != Domain.Enums.BookingStatus.Cancelled)
            .ToListAsync(cancellationToken);

        foreach (var booking in activeBookings)
            booking.Cancel();

        await db.SaveChangesAsync(cancellationToken);
    }
}
