using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Bookings;

/// <summary>
/// A deleted account's guest passes. Runs after AuthController has removed the account's own bookings:
/// passes of bookings that are gone go too; a pass the account had taken goes back to unclaimed, or loses its name once used.
/// </summary>
public class BookingsCleanup(AppDbContext db) : IAccountCleanup
{
    public async Task DeleteAsync(Guid userId, CancellationToken ct)
    {
        await db.Set<GuestPass>().Where(g => !db.Bookings.Any(b => b.Id == g.BookingId)).ExecuteDeleteAsync(ct);
        await db.Set<GuestPass>().Where(g => g.ClaimedByUserId == userId && g.CheckedInAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(g => g.ClaimedByUserId, (Guid?)null).SetProperty(g => g.ClaimedAt, (DateTime?)null), ct);
        await db.Set<GuestPass>().Where(g => g.ClaimedByUserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(g => g.ClaimedByUserId, (Guid?)null), ct);
    }
}
