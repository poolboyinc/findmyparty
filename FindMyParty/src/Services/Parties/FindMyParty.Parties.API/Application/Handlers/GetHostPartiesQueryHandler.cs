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
                .Where(p => p.HostId == query.HostId && !p.IsDeleted && p.Status != Domain.Enums.PartyStatus.Cancelled)
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
                    Status = p.Status.ToString(),
                    ImageUrl = p.ImageUrl,
                    // Revenue derived as TicketsSold × Price. Exact ONLY while
                    // Price is immutable post-publish (Update guards on Draft) and
                    // there are no discounts / per-tier pricing / partial refunds.
                    // If any of those land, source revenue from the Bookings
                    // service's SUM(Booking.TotalPrice) instead.
                    Revenue = p.TicketsSold * p.Price,
                    Genre = p.Genre,
                    PerformerName = p.PerformerName,
                    PerformerType = p.PerformerType,
                    Featured = p.Featured
                })
                .ToListAsync();
        }
    }
}
