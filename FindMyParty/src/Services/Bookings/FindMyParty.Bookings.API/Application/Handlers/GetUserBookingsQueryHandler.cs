using FindMyParty.Bookings.API.Application.Common;
using FindMyParty.Bookings.API.Application.DTOs;
using FindMyParty.Bookings.API.Application.Queries;
using FindMyParty.Bookings.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Bookings.API.Application.Handlers;

public class GetUserBookingsQueryHandler(BookingsDbContext db, ICurrentUserService currentUser)
{
    public async Task<List<BookingResponse>> Handle(GetUserBookingsQuery query)
    {
        return await db.Bookings
            .Where(b => b.UserId == currentUser.UserId)
            .OrderByDescending(b => b.CreatedAt)
            .Select(b => new BookingResponse
            {
                Id = b.Id,
                PartyId = b.PartyId,
                TicketCount = b.TicketCount,
                TotalPrice = b.TotalPrice,
                Status = b.Status.ToString(),
                CreatedAt = b.CreatedAt
            })
            .ToListAsync();
    }
}
