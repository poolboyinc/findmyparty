using FindMyParty.Parties.API.Application.Commands;
using FindMyParty.Parties.API.Domain.Entities;
using FindMyParty.Parties.API.Infrastructure.Data;

namespace FindMyParty.Parties.API.Application.Handlers
{
    public class CreatePartyCommandHandler( PartiesDbContext db)
    {

        public async Task<Guid> Handle(CreatePartyCommand command)
        {
            var party = new Party(
                command.HostId,
                command.Request.Title,
                command.Request.Description,
                command.Request.Price,
                command.Request.Capacity,
                command.Request.StartsAt,
                command.Request.EndsAt,
                command.Request.Latitude,
                command.Request.Longitude,
                command.Request.ImageUrl);

            db.Parties.Add(party);
            await db.SaveChangesAsync();

            return party.Id;
        }
    }
}
