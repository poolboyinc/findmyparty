using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using FindMyParty.Api.Parties;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Bookings;

/// <summary>The Pass at the door: handing the guest their code, scanning it in, and the host's live numbers.</summary>
public class PassService(AppDbContext db)
{
    public async Task<PassResponse> GetPassAsync(Guid userId, Guid bookingId, CancellationToken ct = default)
    {
        var row = await (
            from b in db.Bookings
            where b.Id == bookingId
            join p in db.Parties on b.PartyId equals p.Id
            join v in db.VenueProfiles on p.VenueId equals (Guid?)v.Id into venues
            from v in venues.DefaultIfEmpty()
            select new { b, p.Title, p.StartsAt, p.EndsAt, VenueName = (string?)v.VenueName }).AsNoTracking().FirstOrDefaultAsync(ct)
            ?? throw ApiException.NotFound("Booking");
        if (row.b.UserId != userId) throw ApiException.Forbidden();

        return new PassResponse(row.b.Id, row.b.PassSecret, PassCode.StepSeconds, row.b.TicketCount, row.b.CheckedInCount,
            row.b.Status.ToString(), row.b.PartyId, row.Title, row.VenueName, row.StartsAt, row.EndsAt, row.b.TotalPrice);
    }

    /// <summary>
    /// The door scans a pass. Lets in `admit` guests (default: everyone still outside) exactly once,
    /// however many doors scan the same pass at the same moment.
    /// </summary>
    public async Task<CheckInResponse> CheckInAsync(Guid hostId, string? scanned, int? admit, CancellationToken ct = default)
    {
        if (!PassCode.TryParse(scanned, out var bookingId, out var code))
            throw ApiException.Invalid("This is not a FindMyParty pass.", "invalid_code");

        var row = await (
            from b in db.Bookings
            where b.Id == bookingId
            join p in db.Parties on b.PartyId equals p.Id
            select new { b, p.HostId, p.Title, PartyStatus = p.Status, p.EndsAt }).AsNoTracking().FirstOrDefaultAsync(ct)
            ?? throw ApiException.NotFound("Pass");
        if (row.HostId != hostId) throw ApiException.Forbidden("This pass is for another host's party.");

        var now = DateTime.UtcNow;
        if (!PassCode.IsCurrent(row.b.PassSecret, code, now))
            throw ApiException.Conflict("This code has expired. Ask the guest to open their pass again.", "code_expired");
        if (row.b.Status == BookingStatus.Cancelled)
            throw ApiException.Conflict("This booking was cancelled.", "booking_cancelled");
        if (row.PartyStatus == PartyStatus.Cancelled)
            throw ApiException.Conflict("This party was cancelled.", "party_cancelled");
        if (now > row.EndsAt)
            throw ApiException.Conflict("This party is over.", "party_over");

        var outside = row.b.TicketCount - row.b.CheckedInCount;
        if (outside <= 0) throw AlreadyUsed(row.b.FirstCheckedInAt);
        var letIn = admit ?? outside;
        if (letIn < 1 || letIn > outside)
            throw ApiException.Invalid($"This pass has {outside} guest(s) still to come in.", "admit");

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        // The condition is re-checked by the database, so only one of several simultaneous scans succeeds.
        var updated = await db.Bookings
            .Where(b => b.Id == bookingId && b.Status != BookingStatus.Cancelled && b.CheckedInCount + letIn <= b.TicketCount)
            .ExecuteUpdateAsync(s => s
                .SetProperty(b => b.CheckedInCount, b => b.CheckedInCount + letIn)
                .SetProperty(b => b.FirstCheckedInAt, b => b.FirstCheckedInAt ?? now)
                .SetProperty(b => b.Status, BookingStatus.Confirmed), ct);
        if (updated == 0)
            throw AlreadyUsed(await db.Bookings.Where(b => b.Id == bookingId).Select(b => b.FirstCheckedInAt).FirstAsync(ct));

        db.CheckIns.Add(new CheckIn { Id = Guid.NewGuid(), BookingId = bookingId, PartyId = row.b.PartyId, Admitted = letIn, At = now, ByUserId = hostId });
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        var guestId = row.b.UserId.ToString();
        var guestName = await db.Users.Where(u => u.Id == guestId).Select(u => u.UserName).FirstOrDefaultAsync(ct) ?? "Guest";
        var pricePerGuest = row.b.TicketCount == 0 ? 0 : row.b.TotalPrice / row.b.TicketCount;
        return new CheckInResponse(bookingId, guestName, letIn, row.b.TicketCount, row.b.CheckedInCount + letIn, pricePerGuest * letIn, row.Title);
    }

    private static ApiException AlreadyUsed(DateTime? firstCheckedInAt) =>
        ApiException.Conflict("This pass has already been used.", "already_used").With("firstCheckedInAt", firstCheckedInAt);

    /// <summary>The night in numbers, for the party's host only. Exact counts stay here.</summary>
    public async Task<LiveResponse> LiveAsync(Guid hostId, Guid partyId, CancellationToken ct = default)
    {
        var party = await db.Parties.AsNoTracking().Where(p => p.Id == partyId && !p.IsDeleted)
            .Select(p => new { p.HostId, p.Capacity, p.Price }).FirstOrDefaultAsync(ct) ?? throw ApiException.NotFound("Party");
        if (party.HostId != hostId) throw ApiException.Forbidden();

        var totals = await db.Bookings.Where(b => b.PartyId == partyId && b.Status != BookingStatus.Cancelled)
            .GroupBy(_ => 1)
            .Select(g => new { PassesOut = g.Sum(b => b.TicketCount), CheckedIn = g.Sum(b => b.CheckedInCount) })
            .FirstOrDefaultAsync(ct);
        int passesOut = totals?.PassesOut ?? 0, checkedIn = totals?.CheckedIn ?? 0;

        // Arrivals in quarter-hours over the last two hours, oldest first, empty quarters included.
        var quarter = TimeSpan.FromMinutes(15);
        var now = DateTime.UtcNow;
        var lastStart = new DateTime(now.Ticks - now.Ticks % quarter.Ticks, DateTimeKind.Utc);
        var firstStart = lastStart - 7 * quarter;
        var scans = await db.CheckIns.Where(c => c.PartyId == partyId && c.At >= firstStart).Select(c => new { c.At, c.Admitted }).ToListAsync(ct);
        var arrivals = Enumerable.Range(0, 8)
            .Select(i => firstStart + i * quarter)
            .Select(from => new ArrivalBucket(from, scans.Where(s => s.At >= from && s.At < from + quarter).Sum(s => s.Admitted)))
            .ToList();

        return new LiveResponse(party.Capacity, passesOut, checkedIn, passesOut - checkedIn, party.Price * checkedIn, arrivals);
    }
}
