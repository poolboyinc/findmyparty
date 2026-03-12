using FindMyParty.Parties.API.Application.Cache;
using FindMyParty.Parties.API.Application.Commands;
using FindMyParty.Parties.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;

namespace FindMyParty.Parties.API.Application.Handlers
{
    public enum PublishPartyResult { Success, NotFound, Forbidden, InvalidState }

    public class PublishPartyCommandHandler(PartiesDbContext db, IDistributedCache cache)
    {
        public async Task<PublishPartyResult> Handle(PublishPartyCommand command)
        {
            var party = await db.Parties
                .FirstOrDefaultAsync(p => p.Id == command.PartyId && !p.IsDeleted);

            if (party is null)
                return PublishPartyResult.NotFound;

            if (party.HostId != command.HostId)
                return PublishPartyResult.Forbidden;

            try
            {
                party.Publish();
            }
            catch (InvalidOperationException)
            {
                return PublishPartyResult.InvalidState;
            }

            await db.SaveChangesAsync();

            // Bust the list cache so the newly published party appears immediately
            await cache.SetStringAsync(CacheKeys.ListVersion, Guid.NewGuid().ToString());

            return PublishPartyResult.Success;
        }
    }
}
