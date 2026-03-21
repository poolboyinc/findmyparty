using FindMyParty.Bookings.API.Application.Commands;
using FindMyParty.Bookings.API.Application.Common;
using FindMyParty.Bookings.API.Application.IntegrationEvents;
using FindMyParty.Bookings.API.Domain.Aggregates;
using FindMyParty.Bookings.API.Infrastructure.Data;
using FindMyParty.Bookings.API.Infrastructure.Outbox;
using FindMyParty.Bookings.API.Infrastructure.Services;
using System.Text.Json;

namespace FindMyParty.Bookings.API.Application.Handlers
{
    public class CreateBookingCommandHandler(
        BookingsDbContext db,
        ICurrentUserService currentUser,
        IPartyAvailabilityService partyAvailability,
        IOutboxSignal outboxSignal)
    {
        public async Task<Guid> Handle(CreateBookingCommand command)
        {
            var availability = await partyAvailability
                .CheckAvailabilityAsync(command.PartyId, command.TicketCount);

            if (!availability.IsAvailable)
                throw new InvalidOperationException("Not enough tickets available");

            var booking = new Booking(
                currentUser.UserId,
                command.PartyId,
                command.TicketCount,
                availability.PricePerTicket,
                command.IdempotencyKey,
                availability.EndsAt
            );

            db.Bookings.Add(booking);

            db.OutboxMessages.Add(new OutboxMessage
            {
                Id = Guid.NewGuid(),
                OccurredOnUtc = DateTime.UtcNow,
                Type = typeof(BookingCreatedIntegrationEvent).FullName!,
                Payload = JsonSerializer.Serialize(
                    new BookingCreatedIntegrationEvent(
                        booking.Id,
                        booking.PartyId,
                        booking.UserId,
                        booking.TicketCount))
            });

            await db.SaveChangesAsync();

            // Signal the processor — booking and outbox message are committed, publish now
            outboxSignal.Notify();

            return booking.Id;
        }
    }
}
