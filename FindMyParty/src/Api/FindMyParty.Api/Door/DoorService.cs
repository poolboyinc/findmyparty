using FindMyParty.Api.Bookings;
using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using FindMyParty.Api.Parties;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Door;

/// <summary>What the scanner needs besides the scan itself: where it stands, and tonight's list for when the signal drops.</summary>
public class DoorService(AppDbContext db, TimeProvider time, PassService passes)
{
    /// <summary>A door that opens early sees the party it is about to scan for, and can save its list before the doors open.</summary>
    public static readonly TimeSpan OpensBefore = TimeSpan.FromHours(6);

    private DateTime Now => time.GetUtcNow().UtcDateTime;

    public async Task<DoorContext> ContextAsync(Guid userId, CancellationToken ct = default)
    {
        var id = userId.ToString();
        var hosted = await db.VenueProfiles.AsNoTracking().Where(v => v.UserId == id).Select(v => new { v.Id, v.VenueName }).FirstOrDefaultAsync(ct);
        (Guid VenueId, string VenueName, string Door, string Role) where;
        if (hosted is not null)
        {
            where = (hosted.Id, hosted.VenueName, HostOnlyVenueAccess.HostDoorName, "host");
        }
        else
        {
            var staff = await (
                from s in db.Set<DoorStaff>()
                where s.UserId == id && s.RevokedAt == null
                join v in db.VenueProfiles on s.VenueId equals v.Id
                select new { s.VenueId, v.VenueName, s.DoorName }).AsNoTracking().FirstOrDefaultAsync(ct)
                ?? throw ApiException.Forbidden("This login does not work a door any more.");
            where = (staff.VenueId, staff.VenueName, staff.DoorName, "door");
        }

        var now = Now;
        var party = await db.Parties.AsNoTracking()
            .Where(p => p.VenueId == where.VenueId && p.Status == PartyStatus.Published && !p.IsDeleted && p.EndsAt > now && p.StartsAt <= now + OpensBefore)
            .OrderBy(p => p.StartsAt > now) // one that is on comes before one about to start
            .ThenByDescending(p => p.StartsAt <= now ? p.StartsAt : DateTime.MinValue)
            .ThenBy(p => p.StartsAt)
            .Select(p => new
            {
                p.Id, p.Title, p.StartsAt, p.EndsAt, p.Capacity,
                CheckedIn = db.Bookings.Where(b => b.PartyId == p.Id && (b.Status == BookingStatus.Pending || b.Status == BookingStatus.Confirmed))
                    .Sum(b => (int?)b.CheckedInCount) ?? 0
            })
            .FirstOrDefaultAsync(ct);

        return new DoorContext(where.VenueId, where.VenueName, where.Door, where.Role,
            party is null ? null : new DoorParty(party.Id, party.Title, party.StartsAt, party.EndsAt, party.Capacity, party.CheckedIn));
    }

    /// <summary>Every code that can still let someone in tonight, with what to collect. Ids only: no secrets leave the server.</summary>
    public async Task<DoorManifest> ManifestAsync(Guid userId, Guid partyId, CancellationToken ct = default)
    {
        var party = await db.Parties.AsNoTracking().Where(p => p.Id == partyId && !p.IsDeleted)
            .Select(p => new { p.Id, p.Title, p.Capacity, p.VenueId, p.HostId }).FirstOrDefaultAsync(ct)
            ?? throw ApiException.NotFound("Party");
        if (await passes.DoorNameAsync(userId, party.VenueId, party.HostId, ct) is null)
            throw ApiException.Forbidden("This party is at another venue.");

        var now = Now;
        var bookings = await db.Bookings.AsNoTracking()
            .Where(b => b.PartyId == partyId && (b.Status == BookingStatus.Pending || b.Status == BookingStatus.Confirmed))
            .ToListAsync(ct);
        var checkedIn = bookings.Sum(b => b.CheckedInCount);
        var open = bookings.Where(b => !b.HoldOverAt(now)).ToDictionary(b => b.Id);
        var openIds = open.Keys.ToList();
        var guestPasses = await db.Set<GuestPass>().AsNoTracking()
            .Where(g => openIds.Contains(g.BookingId) && g.ClaimedByUserId != null && g.RevokedAt == null && g.CheckedInAt == null)
            .ToListAsync(ct);
        var people = await People.ReadAsync(db, open.Values.Select(b => b.UserId).Concat(guestPasses.Select(g => g.ClaimedByUserId!.Value)), ct);

        var list = open.Values.Where(b => b.MainOutside > 0).Select(b => new ManifestPass(
                b.Id.ToString("N"), "booking", people.Get(b.UserId).Short, people.Get(b.UserId).LevelName, b.MainOutside, b.PricePerGuest,
                DoorMoney.DueByAdmit(b, false, b.MainOutside, now), b.SkipLine, b.DiscountAt(now) > 0 ? PerkText.Name(b) : null))
            .Concat(guestPasses.Select(g => new ManifestPass(
                g.Id.ToString("N"), "guest", people.Get(g.ClaimedByUserId).Short, people.Get(g.ClaimedByUserId).LevelName, 1,
                open[g.BookingId].PricePerGuest, DoorMoney.DueByAdmit(open[g.BookingId], true, 1, now), false, null)))
            .OrderBy(p => p.GuestName, StringComparer.Ordinal)
            .ToList();

        return new DoorManifest(party.Id, party.Title, now, party.Capacity, checkedIn, list);
    }
}
