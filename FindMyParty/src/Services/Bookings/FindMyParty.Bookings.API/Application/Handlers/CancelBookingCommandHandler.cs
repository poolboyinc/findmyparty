using FindMyParty.Bookings.API.Application.Commands;
using FindMyParty.Bookings.API.Application.Common;
using FindMyParty.Bookings.API.Application.IntegrationEvents;
using FindMyParty.Bookings.API.Infrastructure.Data;
using FindMyParty.Bookings.API.Infrastructure.Outbox;
using System.Text.Json;

namespace FindMyParty.Bookings.API.Application.Handlers;

public class CancelBookingCommandHandler(
    BookingsDbContext db,
    ICurrentUserService currentUser,
    IOutboxSignal outboxSignal)
{
    public async Task Handle(CancelBookingCommand command)
    {
        var booking = await db.Bookings.FindAsync(command.BookingId)
            ?? throw new InvalidOperationException("Booking not found");

        if (booking.UserId != currentUser.UserId)
            throw new UnauthorizedAccessException();

        booking.Cancel();

        db.OutboxMessages.Add(new OutboxMessage
        {
            Id = Guid.NewGuid(),
            OccurredOnUtc = DateTime.UtcNow,
            Type = typeof(BookingCancelledIntegrationEvent).FullName!,
            Payload = JsonSerializer.Serialize(
                new BookingCancelledIntegrationEvent(
                    booking.Id,
                    booking.PartyId,
                    booking.UserId,
                    booking.TicketCount))
        });

        await db.SaveChangesAsync();

        outboxSignal.Notify();
    }
}
