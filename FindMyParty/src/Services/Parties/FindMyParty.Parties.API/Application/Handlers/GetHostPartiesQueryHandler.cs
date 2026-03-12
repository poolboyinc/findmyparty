using FindMyParty.Parties.API.Application.DTOs;
using FindMyParty.Parties.API.Application.Queries;
using FindMyParty.Parties.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Parties.API.Application.Handlers
{
    public class GetHostPartiesQueryHandler(PartiesDbContext db)
    {
        public async Task<List<HostPartyResponse>> Handle(GetHostPartiesQuery query)
        {
            return await db.Parties
                .Where(p => p.HostId == query.HostId && !p.IsDeleted)
                .OrderByDescending(p => p.StartsAt)
                .Select(p => new HostPartyResponse
                {
                    Id = p.Id,
                    Title = p.Title,
                    Description = p.Description,
                    Price = p.Price,
                    Capacity = p.Capacity,
                    TicketsSold = p.TicketsSold,
                    StartsAt = p.StartsAt,
                    EndsAt = p.EndsAt,
                    Latitude = p.Latitude,
                    Longitude = p.Longitude,
                    Status = p.Status.ToString()
                })
                .ToListAsync();
        }
    }
}
