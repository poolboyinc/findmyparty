using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Door;

/// <summary>Who may work a venue's door: its host (as "Host") or one of its active door logins (under its door name).</summary>
public class DoorVenueAccess(AppDbContext db) : IVenueAccess
{
    public async Task<string?> DoorNameAsync(Guid userId, Guid venueId, CancellationToken ct)
    {
        var id = userId.ToString();
        if (await db.VenueProfiles.AnyAsync(v => v.Id == venueId && v.UserId == id, ct)) return HostOnlyVenueAccess.HostDoorName;
        return await db.Set<DoorStaff>()
            .Where(s => s.VenueId == venueId && s.UserId == id && s.RevokedAt == null)
            .Select(s => s.DoorName).FirstOrDefaultAsync(ct);
    }
}
