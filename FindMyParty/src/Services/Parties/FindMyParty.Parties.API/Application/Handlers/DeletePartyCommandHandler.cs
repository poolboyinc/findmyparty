using FindMyParty.Parties.API.Application.Commands;
using FindMyParty.Parties.API.Domain.Enums;
using FindMyParty.Parties.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Parties.API.Application.Handlers
{
    public enum DeletePartyResult { Success, NotFound, Forbidden, InvalidState }

    public class DeletePartyCommandHandler(PartiesDbContext db)
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

            return DeletePartyResult.Success;
        }
    }
}
