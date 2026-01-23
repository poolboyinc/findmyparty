using FindMyParty.Parties.API.Application.DTOs;
using FindMyParty.Parties.API.Application.Queries;
using FindMyParty.Parties.API.Infrastructure.Data;

namespace FindMyParty.Parties.API.Application.Handlers
{
    public class GetPublishedPartiesQueryHandler( PartiesDbContext db)
    {
        public async Task<List<PartyResponse>> Handle(GetPublishedPartiesQuery query)
        {
            return db.Parties
                .Where(p => p.Status == Domain.Enums.PartyStatus.Published && !p.IsDeleted)
                .OrderBy(p => p.StartsAt)
                .Skip((query.Page - 1) * query.PageSize)
                .Take(query.PageSize)
                .Select(p => new PartyResponse
                {
                    Id = p.Id,
                    Title = p.Title,
                    Price = p.Price,
                    StartsAt = p.StartsAt,
                    Latitude = p.Latitude,
                    Longitude = p.Longitude,
                    IsSoldOut = p.TicketsSold >= p.Capacity
                })
                .ToList();
        }
    }
}
