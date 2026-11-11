using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Door;

/// <summary>
/// A deleted account's door logins: a door account loses its login row; a host's venue goes, and with it its door accounts
/// (roles and sessions go with the account rows).
/// </summary>
public class DoorCleanup(AppDbContext db) : IAccountCleanup
{
    public async Task DeleteAsync(Guid userId, CancellationToken ct)
    {
        var id = userId.ToString();
        await db.Set<DoorStaff>().Where(s => s.UserId == id).ExecuteDeleteAsync(ct);

        var venueIds = await db.VenueProfiles.Where(v => v.UserId == id).Select(v => v.Id).ToListAsync(ct);
        if (venueIds.Count == 0) return;
        var doorUsers = await db.Set<DoorStaff>().Where(s => venueIds.Contains(s.VenueId)).Select(s => s.UserId).ToListAsync(ct);
        await db.Set<DoorStaff>().Where(s => venueIds.Contains(s.VenueId)).ExecuteDeleteAsync(ct);
        await db.Users.Where(u => doorUsers.Contains(u.Id)).ExecuteDeleteAsync(ct);
    }
}
