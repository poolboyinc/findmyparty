using FindMyParty.Bookings.API.Application.Commands;
using FindMyParty.Bookings.API.Application.Common;
using FindMyParty.Bookings.API.Application.IntegrationEvents;
using FindMyParty.Bookings.API.Application.IntegrationEvents.EventBus;
using FindMyParty.Bookings.API.Domain.Aggregates;
using FindMyParty.Bookings.API.Infrastructure.Data;
using FindMyParty.Bookings.API.Infrastructure.Outbox;
using FindMyParty.Bookings.API.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace FindMyParty.Bookings.API.Application.Handlers
{
    public class CreateBookingCommandHandler( BookingsDbContext db, 
        ICurrentUserService currentUser, 
        IPartyAvailabilityService partyAvailability)
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
                command.IdempotencyKey
            );

            db.Bookings.Add(booking);

            var outboxMessage = new OutboxMessage
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
            };

            db.OutboxMessages.Add(outboxMessage);

            await db.SaveChangesAsync();


            return booking.Id;
        }

    }
}
