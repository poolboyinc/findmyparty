using FindMyParty.Bookings.API.Application.Common;
using FindMyParty.Bookings.API.Application.DTOs;
using FindMyParty.Bookings.API.Application.Queries;
using FindMyParty.Bookings.API.Infrastructure.Data;
using FindMyParty.Bookings.API.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Bookings.API.Application.Handlers;

public class GetUserBookingsQueryHandler(
    BookingsDbContext db,
    ICurrentUserService currentUser,
    IPartyLookupService partyLookupService)
{
    public async Task<List<UserBookingResponse>> Handle(
        GetUserBookingsQuery query,
        CancellationToken ct = default)
    {
        // Pull the booking rows first — cheap local query, single round-trip.
        var bookings = await db.Bookings
            .Where(b => b.UserId == currentUser.UserId)
            .OrderByDescending(b => b.CreatedAt)
            .Select(b => new
            {
                b.Id,
                b.PartyId,
                b.TicketCount,
                b.TotalPrice,
                b.Status,
                b.CreatedAt,
                b.PartyEndsAt
            })
            .ToListAsync(ct);

        if (bookings.Count == 0)
            return new List<UserBookingResponse>();

        // De-dupe so we don't ship redundant ids cross-service.
        var partyIds = bookings.Select(b => b.PartyId).Distinct().ToList();
        var parties = await partyLookupService.GetByIdsAsync(partyIds, ct);

        return bookings
            .Select(b => new UserBookingResponse(
                b.Id,
                b.PartyId,
                b.TicketCount,
                b.TotalPrice,
                b.Status.ToString(),
                b.CreatedAt,
                b.PartyEndsAt,
                parties.TryGetValue(b.PartyId, out var party) ? party : null))
            .ToList();
    }
}
