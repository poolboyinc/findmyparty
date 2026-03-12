using FindMyParty.Parties.API.Application.Commands;
using FindMyParty.Parties.API.Application.IntegrationEvents;
using FindMyParty.Parties.API.Application.IntegrationEvents.EventBus;
using FindMyParty.Parties.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Parties.API.Application.Handlers
{
    public enum CancelPartyResult { Success, NotFound, Forbidden }

    public class CancelPartyCommandHandler(PartiesDbContext db, IEventBus eventBus)
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

            await eventBus.PublishAsync(new PartyCancelledIntegrationEvent(party.Id));

            return CancelPartyResult.Success;
        }
    }
}
