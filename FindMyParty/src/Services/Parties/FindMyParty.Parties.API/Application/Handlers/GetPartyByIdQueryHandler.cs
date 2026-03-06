using FindMyParty.Parties.API.Application.DTOs;
using FindMyParty.Parties.API.Application.Queries;
using FindMyParty.Parties.API.Infrastructure.Data;

namespace FindMyParty.Parties.API.Application.Handlers;

public class GetPartyByIdQueryHandler(PartiesDbContext db)
{
    public async Task<PartyDetailResponse?> Handle(GetPartyByIdQuery query)
    {
        var party = await db.Parties.FindAsync(query.PartyId);

        if (party == null)
            return null;

        return new PartyDetailResponse
        {
            Id = party.Id,
            Title = party.Title,
            Description = party.Description,
            Price = party.Price,
            Capacity = party.Capacity,
            TicketsSold = party.TicketsSold,
            StartsAt = party.StartsAt,
            EndsAt = party.EndsAt,
            Latitude = party.Latitude,
            Longitude = party.Longitude,
            IsSoldOut = party.TicketsSold >= party.Capacity
        };
    }
}
