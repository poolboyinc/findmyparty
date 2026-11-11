using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using FindMyParty.Api.Parties;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace FindMyParty.Api.Bookings;

/// <summary>The Pass at the door: handing the guest their code, scanning it in (online and replayed offline), and the host's live numbers.</summary>
public class PassService(AppDbContext db, CheckInListeners listeners, TimeProvider time, IVenueAccess access, IConfiguration config)
{
    public const int MaxBatch = 100;

    private DateTime Now => time.GetUtcNow().UtcDateTime;

    // ── the guest's pass ──

    public async Task<PassResponse> GetPassAsync(Guid userId, Guid bookingId, CancellationToken ct = default)
    {
        var row = await (
            from b in db.Bookings
            where b.Id == bookingId
            join p in db.Parties on b.PartyId equals p.Id
            join v in db.VenueProfiles on p.VenueId equals (Guid?)v.Id into venues
            from v in venues.DefaultIfEmpty()
            select new { b, p.Title, p.StartsAt, p.EndsAt, VenueName = (string?)v.VenueName, VenueArea = (string?)v.Area }).AsNoTracking().FirstOrDefaultAsync(ct)
            ?? throw ApiException.NotFound("Booking");
        if (row.b.UserId != userId) throw ApiException.Forbidden();

        var booking = row.b;
        var holder = await People.ReadAsync(db, booking.UserId, ct);
        var admit = booking.IsActive ? Math.Max(0, booking.MainOutside) : 0;
        return new PassResponse(booking.Id, "booking", PassCode.BookingPrefix, booking.Id.ToString("N"), booking.PassSecret, PassCode.StepSeconds,
            booking.TicketCount, booking.MainAdmitted, booking.Status.ToString(), booking.PartyId, row.Title, row.VenueName, row.VenueArea, row.StartsAt, row.EndsAt,
            booking.TotalPrice, admit, admit == 0 ? 0 : booking.DueFor(admit, Now), booking.PerkTitle, booking.SkipLine, BookingService.HeldUntilShown(booking),
            holder.Short, holder.LevelName, null);
    }

    /// <summary>The pass of a guest-pass holder: their own code, worth one spot, at full price.</summary>
    public async Task<PassResponse> GetGuestPassAsync(Guid userId, Guid guestPassId, CancellationToken ct = default)
    {
        var row = await (
            from g in db.Set<GuestPass>()
            where g.Id == guestPassId
            join b in db.Bookings on g.BookingId equals b.Id
            join p in db.Parties on b.PartyId equals p.Id
            join v in db.VenueProfiles on p.VenueId equals (Guid?)v.Id into venues
            from v in venues.DefaultIfEmpty()
            select new { g, b, p.Title, p.StartsAt, p.EndsAt, VenueName = (string?)v.VenueName, VenueArea = (string?)v.Area }).AsNoTracking().FirstOrDefaultAsync(ct)
            ?? throw ApiException.NotFound("Guest pass");
        if (row.g.ClaimedByUserId != userId) throw ApiException.Forbidden();

        var (pass, booking) = (row.g, row.b);
        var people = await People.ReadAsync(db, [userId, booking.UserId], ct);
        var admit = booking.IsActive && pass.RevokedAt is null && pass.CheckedInAt is null ? 1 : 0;
        return new PassResponse(pass.Id, "guest", PassCode.GuestPrefix, pass.Id.ToString("N"), pass.PassSecret, PassCode.StepSeconds,
            1, pass.CheckedInAt is null ? 0 : 1, BookingService.GuestStatus(pass, booking), booking.PartyId, row.Title, row.VenueName, row.VenueArea, row.StartsAt, row.EndsAt,
            booking.PricePerGuest, admit, admit * booking.PricePerGuest, null, false, BookingService.HeldUntilShown(booking),
            people.Get(userId).Short, people.Get(userId).LevelName, people.Get(booking.UserId).First);
    }

    // ── the door ──

    /// <summary>The door name this user scans under at the party's venue, or null when they may not scan there.</summary>
    public async Task<string?> DoorNameAsync(Guid scannerId, Guid? venueId, Guid hostId, CancellationToken ct) =>
        venueId is { } venue ? await access.DoorNameAsync(scannerId, venue, ct)
        : hostId == scannerId ? HostOnlyVenueAccess.HostDoorName
        : null;

    private record PartyRow(Guid Id, Guid HostId, Guid? VenueId, string Title, PartyStatus Status, DateTime EndsAt);

    /// <summary>A scanned code, read and checked. `Id` is the booking id, or the guest pass id for a guest pass.</summary>
    private record Scanned(bool Guest, Guid Id, Booking Booking, GuestPass? GuestPass, PartyRow Party, string Door, int Outside)
    {
        public Guid HolderId => GuestPass?.ClaimedByUserId ?? Booking.UserId;
    }

    /// <summary>Reads a scanned pass and checks everything that can refuse it at moment `at`. Changes nothing.</summary>
    private async Task<Scanned> ReadAsync(Guid scannerId, string? text, DateTime at, CancellationToken ct)
    {
        if (!PassCode.TryParse(text, out var guest, out var id, out var code))
            throw ApiException.Invalid("This is not a FindMyParty pass.", "invalid_code");

        GuestPass? guestPass = null;
        if (guest)
            guestPass = await db.Set<GuestPass>().AsNoTracking().FirstOrDefaultAsync(g => g.Id == id, ct) ?? throw ApiException.NotFound("Pass");
        var bookingId = guestPass?.BookingId ?? id;
        var booking = await db.Bookings.AsNoTracking().FirstOrDefaultAsync(b => b.Id == bookingId, ct) ?? throw ApiException.NotFound("Pass");
        var party = await db.Parties.AsNoTracking().Where(p => p.Id == booking.PartyId)
            .Select(p => new PartyRow(p.Id, p.HostId, p.VenueId, p.Title, p.Status, p.EndsAt)).FirstAsync(ct);

        var door = await DoorNameAsync(scannerId, party.VenueId, party.HostId, ct)
                   ?? throw ApiException.Forbidden("This pass is for another venue's party.");

        if (!PassCode.IsCurrent(guestPass?.PassSecret ?? booking.PassSecret, code, at))
            throw ApiException.Conflict("This code has expired. Ask the guest to open their pass again.", "code_expired");

        var outside = Check(booking, guestPass, party, at);
        if (outside <= 0) throw await AlreadyUsedAsync(booking, guestPass, ct);
        return new Scanned(guest, id, booking, guestPass, party, door, outside);
    }

    /// <summary>Every refusal but "already used"; returns how many this code still lets in.</summary>
    private static int Check(Booking booking, GuestPass? guestPass, PartyRow party, DateTime at)
    {
        if (guestPass is { RevokedAt: not null })
            throw ApiException.Conflict("This guest pass was taken back.", "booking_cancelled");
        if (guestPass is { ClaimedByUserId: null }) throw ApiException.NotFound("Pass");
        if (booking.Status == BookingStatus.Cancelled)
            throw ApiException.Conflict("This booking was cancelled.", "booking_cancelled");
        if (booking.Status == BookingStatus.Expired || booking.HoldOverAt(at)) throw HoldExpired(booking.HeldUntil);
        if (party.Status == PartyStatus.Cancelled)
            throw ApiException.Conflict("This party was cancelled.", "party_cancelled");
        if (at > party.EndsAt)
            throw ApiException.Conflict("This party is over.", "party_over");
        return guestPass is null ? booking.MainOutside : guestPass.CheckedInAt is null ? 1 : 0;
    }

    public static ApiException HoldExpired(DateTime heldUntil) =>
        ApiException.Conflict("This pass was held until its hold ended. The spot went back to the door.", "hold_expired").With("heldUntil", heldUntil);

    /// <summary>"Already used", with when and at which door this code was first scanned.</summary>
    private async Task<ApiException> AlreadyUsedAsync(Booking booking, GuestPass? guestPass, CancellationToken ct)
    {
        Guid? guestPassId = guestPass?.Id;
        var first = await db.CheckIns.AsNoTracking()
            .Where(c => c.BookingId == booking.Id && c.GuestPassId == guestPassId)
            .OrderBy(c => c.At).Select(c => new { c.At, c.DoorName }).FirstOrDefaultAsync(ct);
        return ApiException.Conflict("This pass has already been used.", "already_used")
            .With("firstCheckedInAt", first?.At ?? guestPass?.CheckedInAt ?? booking.FirstCheckedInAt)
            .With("door", first?.DoorName);
    }

    /// <summary>What the door sees after scanning, before choosing how many to let in. Same refusals as a scan.</summary>
    public async Task<CheckInPreview> PreviewAsync(Guid scannerId, string? text, CancellationToken ct = default)
    {
        var now = Now;
        var s = await ReadAsync(scannerId, text, now, ct);
        var holder = await People.ReadAsync(db, s.HolderId, ct);
        var b = s.Booking;
        return new CheckInPreview(s.Id, s.Guest ? "guest" : "booking", s.Party.Id, s.Party.Title, holder.Short, holder.LevelName,
            s.Guest ? 1 : b.TicketCount, s.Guest ? 0 : b.MainAdmitted, s.Outside, b.PricePerGuest,
            DoorMoney.Lines(b, s.Guest, s.Outside, now), DoorMoney.DueByAdmit(b, s.Guest, s.Outside, now), !s.Guest && b.SkipLine);
    }

    /// <summary>
    /// The door lets guests in. Admits `admit` guests (default: everyone this code still lets in) exactly once,
    /// however many doors scan the same pass at the same moment. With `clientScanId`, the same id again returns the first answer.
    /// </summary>
    public Task<CheckInResult> CheckInAsync(Guid scannerId, string? text, int? admit, CancellationToken ct = default) =>
        CheckInAsync(scannerId, text, admit, null, null, ct);

    public async Task<CheckInResult> CheckInAsync(Guid scannerId, string? text, int? admit, Guid? clientScanId, DateTime? scannedAt, CancellationToken ct = default)
    {
        if (clientScanId is not { } known) return await AdmitAsync(scannerId, text, admit, null, scannedAt, ct);
        if (await ResultOfAsync(known, ct) is { } earlier) return earlier;
        try
        {
            return await AdmitAsync(scannerId, text, admit, known, scannedAt, ct);
        }
        catch (ApiException)
        {
            // A copy of this scan was being saved while this one was checked ("already used" by itself): answer as the copy did.
            db.ChangeTracker.Clear();
            if (await ResultOfAsync(known, ct) is { } first) return first;
            throw;
        }
    }

    private async Task<CheckInResult> AdmitAsync(Guid scannerId, string? text, int? admit, Guid? clientScanId, DateTime? scannedAt, CancellationToken ct)
    {

        var at = scannedAt ?? Now;
        var s = await ReadAsync(scannerId, text, at, ct);
        var letIn = admit ?? s.Outside;
        if (letIn < 1 || letIn > s.Outside)
            throw ApiException.Invalid($"This pass has {s.Outside} guest(s) still to come in.", "admit");

        CheckIn checkIn;
        bool firstForGuest;
        await using (var tx = await db.Database.BeginTransactionAsync(ct))
        {
            // The booking's row is locked from here to the commit: other scans of it, a cancel or a new guest pass wait.
            var booking = await db.LockBookingAsync(s.Booking.Id, ct) ?? throw ApiException.NotFound("Pass");
            var guestPass = s.Guest ? await db.Set<GuestPass>().FirstAsync(g => g.Id == s.Id, ct) : null;
            var outside = Check(booking, guestPass, s.Party, at);
            if (outside <= 0) throw await AlreadyUsedAsync(booking, guestPass, ct);
            if (letIn > outside) throw ApiException.Invalid($"This pass has {outside} guest(s) still to come in.", "admit");

            var guestUserId = guestPass?.ClaimedByUserId ?? booking.UserId;
            firstForGuest = !await db.CheckIns.AnyAsync(c => c.BookingId == booking.Id && c.GuestUserId == guestUserId, ct);
            decimal due;
            if (guestPass is not null)
            {
                due = booking.PricePerGuest;
                guestPass.CheckedInAt = at;
                booking.AdmitGuest(at);
            }
            else
            {
                due = booking.DueFor(letIn, at);
                booking.AdmitMain(letIn, at);
            }

            checkIn = new CheckIn
            {
                Id = Guid.NewGuid(), BookingId = booking.Id, PartyId = booking.PartyId, Admitted = letIn, At = at, ByUserId = scannerId,
                GuestUserId = guestUserId, DoorName = s.Door, AmountDue = due, ClientScanId = clientScanId, GuestPassId = guestPass?.Id
            };
            db.CheckIns.Add(checkIn);
            try
            {
                await db.SaveChangesAsync(ct);
            }
            catch (DbUpdateException e) when (clientScanId is not null && e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
            {
                // The same scan arrived twice at once and the other copy won: answer as it did.
                await tx.RollbackAsync(ct);
                db.ChangeTracker.Clear();
                return await ResultOfAsync(clientScanId.Value, ct) ?? throw ApiException.Conflict("Please try again.", "retry");
            }
            await tx.CommitAsync(ct);
        }

        // The scan stands from here on. Listeners (Glow, pushes) are told even if the door's phone has hung up.
        // For a guest pass the event carries the guest pass id: that is the id the guest's phone knows its pass by.
        await listeners.PublishAsync(
            new CheckInEvent(checkIn.Id, s.Guest ? s.Id : checkIn.BookingId, checkIn.PartyId, s.Party.VenueId, checkIn.GuestUserId, letIn, at, firstForGuest),
            CancellationToken.None);

        return await ResultOfAsync(checkIn.Id, byCheckInId: true, ct) ?? throw ApiException.NotFound("Pass");
    }

    private Task<CheckInResult?> ResultOfAsync(Guid clientScanId, CancellationToken ct) => ResultOfAsync(clientScanId, byCheckInId: false, ct);

    /// <summary>The answer for a scan that was recorded, rebuilt from its row.</summary>
    private async Task<CheckInResult?> ResultOfAsync(Guid id, bool byCheckInId, CancellationToken ct)
    {
        var scans = byCheckInId ? db.CheckIns.Where(c => c.Id == id) : db.CheckIns.Where(c => c.ClientScanId == id);
        var row = await (
            from c in scans
            join b in db.Bookings on c.BookingId equals b.Id
            join p in db.Parties on c.PartyId equals p.Id
            select new { c, b, p.Title }).AsNoTracking().FirstOrDefaultAsync(ct);
        if (row is null) return null;
        var (scan, booking) = (row.c, row.b);
        var person = await People.ReadAsync(db, scan.GuestUserId, ct);
        var guest = scan.GuestPassId is not null;
        return new CheckInResult(scan.GuestPassId ?? booking.Id, person.Short, person.LevelName, scan.Admitted,
            guest ? 1 : booking.TicketCount, guest ? 1 : booking.MainAdmitted, scan.AmountDue, row.Title, scan.DoorName, scan.ClientScanId);
    }

    /// <summary>
    /// Scans a door phone made without signal, replayed in order. Each is checked at the moment it was made and recorded then,
    /// once (by its clientScanId). One that is refused does not stop the rest.
    /// </summary>
    public async Task<BatchScanResponse> CheckInBatchAsync(Guid scannerId, List<BatchScanItem>? items, CancellationToken ct = default)
    {
        if (items is null || items.Count == 0) return new BatchScanResponse([]);
        if (items.Count > MaxBatch) throw ApiException.Invalid($"Send up to {MaxBatch} scans at a time.", "batch_too_big");

        var window = TimeSpan.FromMinutes(config.GetValue("Door:OfflineWindowMinutes", 15));
        var results = new List<BatchScanResult>();
        foreach (var item in items)
        {
            var now = Now;
            var scannedAt = Utc(item.ScannedAt);
            if (scannedAt > now) scannedAt = now; // a door phone whose clock runs ahead
            try
            {
                if (now - scannedAt > window && await ResultOfAsync(item.ClientScanId, ct) is null)
                    throw ApiException.Conflict("Scanned too long ago to count. Scan the pass again.", "offline_too_old");
                var result = await CheckInAsync(scannerId, item.Code, item.Admit, item.ClientScanId, scannedAt, ct);
                results.Add(new BatchScanResult(item.ClientScanId, "admitted", result));
            }
            catch (ApiException e)
            {
                db.ChangeTracker.Clear();
                results.Add(new BatchScanResult(item.ClientScanId, "refused", Code: e.Code, Title: e.Message));
            }
        }
        return new BatchScanResponse(results);
    }

    private static DateTime Utc(DateTime t) => t.Kind switch
    {
        DateTimeKind.Utc => t,
        DateTimeKind.Local => t.ToUniversalTime(),
        _ => DateTime.SpecifyKind(t, DateTimeKind.Utc)
    };

    // ── the host's numbers ──

    /// <summary>The night in numbers, for the party's host only. Exact counts stay here.</summary>
    public async Task<PartyLive> LiveAsync(Guid hostId, Guid partyId, CancellationToken ct = default)
    {
        var party = await db.Parties.AsNoTracking().Where(p => p.Id == partyId && !p.IsDeleted)
            .Select(p => new { p.HostId, p.Title, p.StartsAt, p.EndsAt, p.Capacity, p.VenueId }).FirstOrDefaultAsync(ct)
            ?? throw ApiException.NotFound("Party");
        if (party.HostId != hostId) throw ApiException.Forbidden();
        var now = Now;

        var totals = await db.Bookings.Where(b => b.PartyId == partyId && (b.Status == BookingStatus.Pending || b.Status == BookingStatus.Confirmed))
            .GroupBy(_ => 1)
            .Select(g => new { PassesOut = g.Sum(b => b.TicketCount), CheckedIn = g.Sum(b => b.CheckedInCount) })
            .FirstOrDefaultAsync(ct);
        int passesOut = totals?.PassesOut ?? 0, checkedIn = totals?.CheckedIn ?? 0;

        var scans = await db.CheckIns.AsNoTracking().Where(c => c.PartyId == partyId)
            .Select(c => new { c.At, c.Admitted, c.AmountDue, c.GuestUserId }).ToListAsync(ct);

        // Arrivals in eight quarter-hours ending at now, or at the end once the party is over; oldest first, empty ones included.
        var quarter = TimeSpan.FromMinutes(15);
        var end = now < party.EndsAt ? now : party.EndsAt;
        var last = end.AddTicks(-1);
        var lastStart = new DateTime(last.Ticks - last.Ticks % quarter.Ticks, DateTimeKind.Utc);
        var arrivals = Enumerable.Range(0, 8)
            .Select(i => lastStart - (7 - i) * quarter)
            .Select(from => new ArrivalBucket(from, scans.Where(s => s.At >= from && s.At < from + quarter).Sum(s => s.Admitted)))
            .ToList();

        // New faces: guests let in whose account had never been scanned in at this venue before.
        var guestIds = scans.Select(s => s.GuestUserId).Distinct().ToList();
        var seenBefore = party.VenueId is { } venueId
            ? await (from c in db.CheckIns
                     join p in db.Parties on c.PartyId equals p.Id
                     where p.VenueId == venueId && c.PartyId != partyId && guestIds.Contains(c.GuestUserId)
                     group c by c.GuestUserId into g
                     select new { GuestUserId = g.Key, First = g.Min(c => c.At) }).ToDictionaryAsync(x => x.GuestUserId, x => x.First, ct)
            : [];
        var newFaces = scans.Where(s => !seenBefore.TryGetValue(s.GuestUserId, out var first) || first >= s.At).Sum(s => s.Admitted);

        var status = now < party.StartsAt ? "upcoming" : now >= party.EndsAt ? "ended" : "live";
        var beam = status == "live" && party.VenueId is { } venue ? await BeamAsync(venue, checkedIn, now, ct) : null;

        return new PartyLive(party.Title, party.StartsAt, party.EndsAt, status, party.Capacity, passesOut, checkedIn, passesOut - checkedIn,
            scans.Sum(s => s.AmountDue), arrivals, newFaces, beam);
    }

    /// <summary>Where this venue stands among the city's venues with a party on now, by guests inside. Names only.</summary>
    private async Task<PartyBeam?> BeamAsync(Guid venueId, int checkedIn, DateTime now, CancellationToken ct)
    {
        var city = await db.VenueProfiles.Where(v => v.Id == venueId).Select(v => v.CitySlug).FirstOrDefaultAsync(ct);
        if (city is null) return null;
        var running = await (
            from p in db.Parties
            where p.Status == PartyStatus.Published && !p.IsDeleted && p.StartsAt <= now && p.EndsAt > now && p.VenueId != null
            join v in db.VenueProfiles on p.VenueId equals (Guid?)v.Id
            where v.CitySlug == city
            select new
            {
                VenueId = v.Id,
                v.VenueName,
                Inside = db.Bookings.Where(b => b.PartyId == p.Id && (b.Status == BookingStatus.Pending || b.Status == BookingStatus.Confirmed))
                    .Sum(b => (int?)b.CheckedInCount) ?? 0
            }).AsNoTracking().ToListAsync(ct);

        var ranked = running.GroupBy(r => r.VenueId)
            .Select(g => new { VenueId = g.Key, g.First().VenueName, Inside = g.Sum(r => r.Inside) })
            .OrderByDescending(r => r.Inside).ThenBy(r => r.VenueName, StringComparer.Ordinal).ThenBy(r => r.VenueId)
            .ToList();
        var rank = ranked.FindIndex(r => r.VenueId == venueId) + 1;
        if (rank == 0) return null;
        return new PartyBeam(rank, ranked.Count, Crowd.Level(checkedIn), ranked[0].VenueName, ranked.Count > 1 ? ranked[1].VenueName : null);
    }
}

/// <summary>What the door collects, line by line, as the scanner and the offline manifest show it.</summary>
public static class DoorMoney
{
    public static List<MoneyLine> Lines(Booking b, bool guest, int outside, DateTime at)
    {
        if (outside <= 0) return [];
        var lines = new List<MoneyLine> { new($"Entry, {outside} × {Money.Format(b.PricePerGuest)}", outside * b.PricePerGuest, false) };
        var discount = guest ? 0 : Math.Min(b.DiscountAt(at), outside * b.PricePerGuest);
        if (discount > 0) lines.Add(new MoneyLine(PerkLabel(b), -discount, true));
        return lines;
    }

    /// <summary>dueByAdmit[n-1] = what to collect when letting n in.</summary>
    public static List<decimal> DueByAdmit(Booking b, bool guest, int outside, DateTime at) =>
        Enumerable.Range(1, Math.Max(outside, 0)).Select(n => guest ? n * b.PricePerGuest : b.DueFor(n, at)).ToList();

    /// <summary>The perk's line at the door, built from its key: "Free before midnight (1 guest)", "Free +1 (1 guest)".</summary>
    public static string PerkLabel(Booking b)
    {
        var guests = Math.Max(b.PerkGuests, 1);
        return $"{PerkText.Name(b)} ({guests} guest{(guests == 1 ? "" : "s")})";
    }
}
