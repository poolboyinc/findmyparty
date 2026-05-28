using FindMyParty.Parties.API.Application.DTOs;
using FindMyParty.Parties.API.Application.Queries;
using FindMyParty.Parties.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Parties.API.Application.Handlers;

public class GetPartiesByIdsQueryHandler(PartiesDbContext db)
{
    // Hard cap to bound the IN-list size regardless of what the caller sends.
    // The intended caller (Bookings.API) already de-dupes, so 100 is generous.
    private const int MaxIds = 100;

    public async Task<List<BookingPartyDto>> Handle(GetPartiesByIdsQuery query)
    {
        if (query.Ids == null || query.Ids.Length == 0)
            return new List<BookingPartyDto>();

        var ids = query.Ids.Take(MaxIds).ToArray();

        // Return parties of ANY status (Draft / Published / Cancelled / SoldOut)
        // — a booking-card needs to render correctly even if the host cancelled
        // the party after the booking was made. Only IsDeleted is filtered out.
        return await db.Parties
            .Where(p => ids.Contains(p.Id) && !p.IsDeleted)
            .Select(p => new BookingPartyDto(
                p.Id,
                p.Title,
                p.ImageUrl,
                p.StartsAt,
                p.EndsAt,
                p.Latitude,
                p.Longitude,
                p.Genre,
                p.PerformerName,
                p.PerformerType,
                p.Status.ToString()))
            .ToListAsync();
    }
}
