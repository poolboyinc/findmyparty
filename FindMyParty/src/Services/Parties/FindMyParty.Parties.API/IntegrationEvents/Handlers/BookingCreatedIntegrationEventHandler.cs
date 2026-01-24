using FindMyParty.Parties.API.Infrastructure.Data;
using FindMyParty.Parties.API.Infrastructure.IntegrationEvents;
using FindMyParty.Parties.API.IntegrationEvents.Events;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Parties.API.Application.IntegrationEvents.Handlers
{
    public class BookingCreatedIntegrationEventHandler( PartiesDbContext db, IEventBus eventBus)
    {
        public async Task Handle(BookingCreatedIntegrationEvent @event)
        {
            var party = await db.Parties
                .FirstOrDefaultAsync(p => p.Id == @event.PartyId);

            if (party == null)
                return;

            try
            {
                party.ReserveCapacity(@event.TicketCount);
                await db.SaveChangesAsync();
            }
            catch
            {
                await eventBus.PublishAsync(
                    new PartyCapacityExceededIntegrationEvent(
                        @event.BookingId,
                        @event.PartyId
                    ));
            }
        }
    }
}
