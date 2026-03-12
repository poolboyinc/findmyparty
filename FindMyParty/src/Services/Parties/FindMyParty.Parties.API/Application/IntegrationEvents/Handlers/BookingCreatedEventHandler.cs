using FindMyParty.Parties.API.Application.Cache;
using FindMyParty.Parties.API.Application.IntegrationEvents;
using FindMyParty.Parties.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;


namespace FindMyParty.Parties.API.Application.IntegrationEvents.Handlers
{
    public class BookingCreatedEventHandler(PartiesDbContext db, IDistributedCache cache)
    {
        public async Task Handle(BookingCreatedIntegrationEvent @event, CancellationToken cancellationToken)
        {
            // Idempotency check
            var alreadyProcessed = await db.ProcessedEvents.AnyAsync(e =>
                e.Id == @event.BookingId &&
                e.EventType == nameof(BookingCreatedIntegrationEvent));

            if (alreadyProcessed)
                return;

            var party = await db.Parties
                .FirstOrDefaultAsync(p => p.Id == @event.PartyId);

            if (party == null)
                return; // or log — event arrived before party sync

            party.AddTicketsSold(@event.TicketCount);

            if (party.TicketsSold >= party.Capacity)
                party.MarkSoldOut();

            db.ProcessedEvents.Add(new ProcessedEvent
            {
                Id = @event.BookingId,
                EventType = nameof(BookingCreatedIntegrationEvent),
                ProcessedOnUtc = DateTime.UtcNow
            });

            await db.SaveChangesAsync();

            // Invalidate availability cache so next read reflects updated ticket count
            await cache.RemoveAsync(CacheKeys.Availability(@event.PartyId));
        }
    }
}
