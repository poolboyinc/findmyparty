using FindMyParty.Parties.API.Application.Commands;
using FindMyParty.Parties.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Parties.API.Application.Handlers
{
    public enum UpdatePartyResult { Success, NotFound, Forbidden, InvalidState }

    public class UpdatePartyCommandHandler(PartiesDbContext db)
    {
        public async Task<UpdatePartyResult> Handle(UpdatePartyCommand command)
        {
            var party = await db.Parties
                .FirstOrDefaultAsync(p => p.Id == command.PartyId && !p.IsDeleted);

            if (party is null)
                return UpdatePartyResult.NotFound;

            if (party.HostId != command.HostId)
                return UpdatePartyResult.Forbidden;

            try
            {
                party.Update(
                    command.Request.Title,
                    command.Request.Description,
                    command.Request.Price,
                    command.Request.Capacity,
                    command.Request.StartsAt,
                    command.Request.EndsAt,
                    command.Request.Latitude,
                    command.Request.Longitude,
                    command.Request.ImageUrl);
            }
            catch (InvalidOperationException)
            {
                return UpdatePartyResult.InvalidState;
            }

            await db.SaveChangesAsync();
            return UpdatePartyResult.Success;
        }
    }
}
