using FindMyParty.Parties.API.Application.Cache;
using FindMyParty.Parties.API.Application.Commands;
using FindMyParty.Parties.API.Application.IntegrationEvents;
using FindMyParty.Parties.API.Application.IntegrationEvents.EventBus;
using FindMyParty.Parties.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;

namespace FindMyParty.Parties.API.Application.Handlers
{
    public enum CancelPartyResult { Success, NotFound, Forbidden }

    public class CancelPartyCommandHandler(PartiesDbContext db, IEventBus eventBus, IDistributedCache cache)
    {
        public async Task<CancelPartyResult> Handle(CancelPartyCommand command)
        {
            var party = await db.Parties
                .FirstOrDefaultAsync(p => p.Id == command.PartyId && !p.IsDeleted);

            if (party is null)
                return CancelPartyResult.NotFound;

            if (party.HostId != command.HostId)
                return CancelPartyResult.Forbidden;

            party.Cancel();
            await db.SaveChangesAsync();

            await Task.WhenAll(
                eventBus.PublishAsync(new PartyCancelledIntegrationEvent(party.Id)),
                cache.RemoveAsync(CacheKeys.Availability(party.Id)),
                cache.SetStringAsync(CacheKeys.ListVersion, Guid.NewGuid().ToString())
            );

            return CancelPartyResult.Success;
        }
    }
}
