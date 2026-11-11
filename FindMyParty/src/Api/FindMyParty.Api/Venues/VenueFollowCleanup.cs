using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Venues;

/// <summary>A deleted account follows nothing.</summary>
public class VenueFollowCleanup(AppDbContext db) : IAccountCleanup
{
    public Task DeleteAsync(Guid userId, CancellationToken ct) =>
        db.Set<VenueFollow>().Where(f => f.UserId == userId).ExecuteDeleteAsync(ct);
}
