using FindMyParty.Parties.API.Application.Cache;
using FindMyParty.Parties.API.Application.Commands;
using FindMyParty.Parties.API.Domain.Enums;
using FindMyParty.Parties.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;

namespace FindMyParty.Parties.API.Application.Handlers
{
    public enum DeletePartyResult { Success, NotFound, Forbidden, InvalidState }

    public class DeletePartyCommandHandler(PartiesDbContext db, IDistributedCache cache)
    {
        public async Task<DeletePartyResult> Handle(DeletePartyCommand command)
        {
            var party = await db.Parties
                .FirstOrDefaultAsync(p => p.Id == command.PartyId && !p.IsDeleted);

            if (party is null)
                return DeletePartyResult.NotFound;

            if (party.HostId != command.HostId)
                return DeletePartyResult.Forbidden;

            if (party.Status != PartyStatus.Draft)
                return DeletePartyResult.InvalidState;

            party.Delete();
            await db.SaveChangesAsync();

            await Task.WhenAll(
                cache.RemoveAsync(CacheKeys.Availability(party.Id)),
                cache.SetStringAsync(CacheKeys.ListVersion, Guid.NewGuid().ToString())
            );

            return DeletePartyResult.Success;
        }
    }
}
