using FindMyParty.Parties.API.Application.Commands;
using FindMyParty.Parties.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Parties.API.Application.Handlers
{
    public enum PublishPartyResult { Success, NotFound, Forbidden, InvalidState }

    public class PublishPartyCommandHandler(PartiesDbContext db)
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
            return PublishPartyResult.Success;
        }
    }
}
