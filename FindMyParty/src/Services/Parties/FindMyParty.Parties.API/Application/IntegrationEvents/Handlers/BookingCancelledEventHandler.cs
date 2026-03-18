using FindMyParty.Parties.API.Application.Cache;
using FindMyParty.Parties.API.Application.IntegrationEvents;
using FindMyParty.Parties.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;

namespace FindMyParty.Parties.API.Application.IntegrationEvents.Handlers
{
    public class BookingCancelledEventHandler(PartiesDbContext db, IDistributedCache cache)
    {
        public async Task Handle(BookingCancelledIntegrationEvent @event, CancellationToken cancellationToken)
        {
            // Idempotency check
            var alreadyProcessed = await db.ProcessedEvents.AnyAsync(e =>
                e.Id == @event.BookingId &&
                e.EventType == nameof(BookingCancelledIntegrationEvent));

            if (alreadyProcessed)
                return;

            var party = await db.Parties
                .FirstOrDefaultAsync(p => p.Id == @event.PartyId);

            if (party == null)
                return;

            party.RemoveTicketsSold(@event.TicketCount);

            db.ProcessedEvents.Add(new ProcessedEvent
            {
                Id = @event.BookingId,
                EventType = nameof(BookingCancelledIntegrationEvent),
                ProcessedOnUtc = DateTime.UtcNow
            });

            await db.SaveChangesAsync();

            // Invalidate availability cache so the freed capacity is visible immediately
            await cache.RemoveAsync(CacheKeys.Availability(@event.PartyId));
        }
    }
}
