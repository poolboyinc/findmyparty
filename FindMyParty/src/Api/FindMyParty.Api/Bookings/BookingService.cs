using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using FindMyParty.Api.Parties;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace FindMyParty.Api.Bookings;

public class BookingService(
    AppDbContext db,
    TimeProvider time,
    IEnumerable<IBookingPricer> pricers,
    IConfiguration config,
    GuestPassLinks links)
{
    /// <summary>Guests on one booking. One request can no longer take a whole venue.</summary>
    public const int MaxTicketsPerBooking = 6;

    private DateTime Now => time.GetUtcNow().UtcDateTime;

    private record PartyFacts(PartyStatus Status, DateTime StartsAt, DateTime EndsAt, decimal Price, int HoldMinutes, int TicketsSold, int Capacity);

    private Task<PartyFacts?> PartyAsync(Guid partyId, CancellationToken ct) =>
        db.Parties.AsNoTracking().Where(p => p.Id == partyId && !p.IsDeleted)
            .Select(p => new PartyFacts(p.Status, p.StartsAt, p.EndsAt, p.Price, p.HoldMinutes, p.TicketsSold, p.Capacity))
            .FirstOrDefaultAsync(ct);

    private static void CheckTicketCount(int ticketCount)
    {
        if (ticketCount is < 1 or > MaxTicketsPerBooking)
            throw ApiException.Invalid($"A booking is for 1 to {MaxTicketsPerBooking} guests.", "ticket_count");
    }

    private static void CheckBookable(PartyFacts party, DateTime now)
    {
        if (party.Status != PartyStatus.Published || party.EndsAt <= now)
            throw ApiException.Conflict("This party is not open for booking.", "not_bookable");
    }

    /// <summary>The hold: from the start (or from now, when booked after the start) for the party's hold minutes, never past the end.</summary>
    private DateTime HoldUntil(PartyFacts party, DateTime now)
    {
        var minutes = party.HoldMinutes > 0 ? party.HoldMinutes : config.GetValue("Bookings:DefaultHoldMinutes", Party.DefaultHoldMinutes);
        var until = (party.StartsAt > now ? party.StartsAt : now).AddMinutes(minutes);
        return until < party.EndsAt ? until : party.EndsAt;
    }

    /// <summary>The first perk any pricer offers, or null.</summary>
    private async Task<PerkQuote?> PerkAsync(Guid userId, Guid partyId, int ticketCount, DateTime now, CancellationToken ct)
    {
        foreach (var pricer in pricers)
            if (await pricer.QuoteAsync(userId, partyId, ticketCount, now, ct) is { } perk)
                return perk;
        return null;
    }

    /// <summary>A booking as it would be made now, not saved: price, perk and hold. Booking and quote share it, so they agree.</summary>
    private async Task<Booking> PriceAsync(Guid userId, Guid partyId, int ticketCount, string key, PartyFacts party, DateTime now, CancellationToken ct)
    {
        var booking = new Booking(userId, partyId, ticketCount, party.Price, key, party.EndsAt, HoldUntil(party, now), now);
        booking.FixPerk(await PerkAsync(userId, partyId, ticketCount, now, ct));
        return booking;
    }

    /// <summary>What the checkout shows: price, the perk the guest would get, what is left to pay at the door, and the hold.</summary>
    public async Task<BookingQuote> QuoteAsync(Guid userId, Guid partyId, int ticketCount, CancellationToken ct = default)
    {
        CheckTicketCount(ticketCount);
        var now = Now;
        var party = await PartyAsync(partyId, ct) ?? throw ApiException.NotFound("Party");
        CheckBookable(party, now);
        if (party.TicketsSold + ticketCount > party.Capacity) throw ApiException.Conflict("Not enough spots left.", "sold_out");

        var priced = await PriceAsync(userId, partyId, ticketCount, "", party, now, ct);
        return new BookingQuote(
            partyId, ticketCount,
            Math.Clamp(party.Capacity - party.TicketsSold, 0, MaxTicketsPerBooking),
            party.Price,
            priced.TotalPrice,
            priced.PerkKey is null ? null : new QuotePerk(priced.PerkKey, PerkText.Checkout(priced), priced.PerkGuests, priced.PerkDiscount, priced.PerkValidUntil),
            priced.SkipLine,
            Math.Max(0, priced.TotalPrice - priced.PerkDiscount),
            priced.HeldUntil);
    }

    /// <summary>
    /// Holds spots and records the booking in one transaction. Safe to retry with the same key:
    /// the same booking comes back and no extra spots are held.
    /// </summary>
    public async Task<Guid> CreateAsync(Guid userId, Guid partyId, int ticketCount, string idempotencyKey, CancellationToken ct = default)
    {
        CheckTicketCount(ticketCount);
        if (idempotencyKey.Length > 100)
            throw ApiException.Invalid("Idempotency-Key is too long.", "idempotency_key");

        if (await FindByKeyAsync(userId, idempotencyKey, partyId, ticketCount, ct) is { } earlier) return earlier;

        var now = Now;
        var facts = await PartyAsync(partyId, ct) ?? throw ApiException.NotFound("Party");
        // Priced before the transaction: a pricer reads other features' tables and must not hold the party's row meanwhile.
        var booking = await PriceAsync(userId, partyId, ticketCount, idempotencyKey, facts, now, ct);

        await using var tx = await db.Database.BeginTransactionAsync(ct);

        // One statement decides who gets the last spots: it only updates if the party is open and has room.
        var held = await db.Parties
            .Where(p => p.Id == partyId && !p.IsDeleted && p.Status == PartyStatus.Published && p.EndsAt > now
                        && p.TicketsSold + ticketCount <= p.Capacity)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.TicketsSold, p => p.TicketsSold + ticketCount), ct);

        if (held == 0)
        {
            var party = await PartyAsync(partyId, ct) ?? throw ApiException.NotFound("Party");
            CheckBookable(party, now);
            throw ApiException.Conflict("Not enough spots left.", "sold_out");
        }

        db.Bookings.Add(booking);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // The same key arrived twice at once and the other request won. Undo our hold and return its booking.
            await tx.RollbackAsync(ct);
            db.ChangeTracker.Clear();
            return await FindByKeyAsync(userId, idempotencyKey, partyId, ticketCount, ct)
                   ?? throw ApiException.Conflict("Please try again.", "retry");
        }

        await tx.CommitAsync(ct);
        return booking.Id;
    }

    private async Task<Guid?> FindByKeyAsync(Guid userId, string key, Guid partyId, int ticketCount, CancellationToken ct)
    {
        var existing = await db.Bookings.AsNoTracking()
            .Where(b => b.UserId == userId && b.IdempotencyKey == key)
            .Select(b => new { b.Id, b.PartyId, b.TicketCount })
            .FirstOrDefaultAsync(ct);
        if (existing is null) return null;
        if (existing.PartyId != partyId || existing.TicketCount != ticketCount)
            throw ApiException.Conflict("This Idempotency-Key was already used for a different booking.", "idempotency_key_reused");
        return existing.Id;
    }

    /// <summary>
    /// Cancels the guest's own booking while nobody on it is inside: the spots go back and its guest passes are taken back.
    /// Cancelling twice, or a booking whose hold already ended, is harmless.
    /// </summary>
    public async Task CancelAsync(Guid userId, Guid bookingId, CancellationToken ct = default)
    {
        var owner = await db.Bookings.Where(b => b.Id == bookingId).Select(b => (Guid?)b.UserId).FirstOrDefaultAsync(ct)
                    ?? throw ApiException.NotFound("Booking");
        if (owner != userId) throw ApiException.Forbidden();

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        // The row stays locked to the end, so a scan at the door and the cancel cannot both go through.
        var booking = await db.LockBookingAsync(bookingId, ct) ?? throw ApiException.NotFound("Booking");
        if (!booking.IsActive) return;
        if (booking.CheckedInCount > 0) throw GuestInside();

        booking.Cancel();
        await db.SaveChangesAsync(ct);
        await ReleaseAsync(db, booking.PartyId, booking.TicketCount, ct);
        await RevokeGuestPassesAsync(db, booking.Id, Now, ct);
        await tx.CommitAsync(ct);
    }

    public static ApiException GuestInside() => ApiException.Conflict("Someone on this pass is already inside.", "guest_inside");

    public static Task ReleaseAsync(AppDbContext db, Guid partyId, int tickets, CancellationToken ct) =>
        db.Parties
            .Where(p => p.Id == partyId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.TicketsSold, p => p.TicketsSold >= tickets ? p.TicketsSold - tickets : 0), ct);

    public static Task RevokeGuestPassesAsync(AppDbContext db, Guid bookingId, DateTime now, CancellationToken ct) =>
        db.Set<GuestPass>()
            .Where(g => g.BookingId == bookingId && g.RevokedAt == null && g.CheckedInAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(g => g.RevokedAt, now), ct);

    /// <summary>The party's host marks a pending booking as confirmed (for example, paid at the door).</summary>
    public async Task ConfirmAsync(Guid hostId, Guid bookingId, CancellationToken ct = default)
    {
        var partyId = await db.Bookings.Where(b => b.Id == bookingId).Select(b => (Guid?)b.PartyId).FirstOrDefaultAsync(ct)
                      ?? throw ApiException.NotFound("Booking");
        await EnsureHostOwnsAsync(hostId, partyId, ct);

        var confirmed = await db.Bookings
            .Where(b => b.Id == bookingId && b.Status == BookingStatus.Pending)
            .ExecuteUpdateAsync(s => s.SetProperty(b => b.Status, BookingStatus.Confirmed), ct);
        if (confirmed == 0)
        {
            var status = await db.Bookings.Where(b => b.Id == bookingId).Select(b => b.Status).FirstAsync(ct);
            if (status == BookingStatus.Cancelled) throw ApiException.Conflict("This booking was cancelled.", "booking_cancelled");
            if (status == BookingStatus.Expired) throw ApiException.Conflict("The hold on this booking ended.", "hold_expired");
        }
    }

    /// <summary>My bookings, and the guest passes others gave me, newest first.</summary>
    public async Task<List<BookingResponse>> ForUserAsync(Guid userId, CancellationToken ct = default)
    {
        var now = Now;
        var own = await (
            from b in db.Bookings
            where b.UserId == userId
            join p in db.Parties.Where(p => !p.IsDeleted) on b.PartyId equals p.Id into parties
            from p in parties.DefaultIfEmpty()
            join v in db.VenueProfiles on p.VenueId equals (Guid?)v.Id into venues
            from v in venues.DefaultIfEmpty()
            select new { b, p, VenueName = (string?)v.VenueName, VenueArea = (string?)v.Area }).AsNoTracking().ToListAsync(ct);

        var ownIds = own.Select(r => r.b.Id).ToList();
        var given = await db.Set<GuestPass>().AsNoTracking()
            .Where(g => ownIds.Contains(g.BookingId) && g.RevokedAt == null)
            .OrderBy(g => g.CreatedAt).ToListAsync(ct);

        var mine = await (
            from g in db.Set<GuestPass>()
            where g.ClaimedByUserId == userId
            join b in db.Bookings on g.BookingId equals b.Id
            join p in db.Parties.Where(p => !p.IsDeleted) on b.PartyId equals p.Id into parties
            from p in parties.DefaultIfEmpty()
            join v in db.VenueProfiles on p.VenueId equals (Guid?)v.Id into venues
            from v in venues.DefaultIfEmpty()
            select new { g, b, p, VenueName = (string?)v.VenueName, VenueArea = (string?)v.Area }).AsNoTracking().ToListAsync(ct);

        var people = await People.ReadAsync(db,
            given.Where(g => g.ClaimedByUserId is not null).Select(g => g.ClaimedByUserId!.Value).Concat(mine.Select(r => r.b.UserId)), ct);

        var rows = own.Select(r => new BookingResponse(
            r.b.Id, r.b.PartyId, r.b.TicketCount, r.b.TotalPrice, r.b.Status.ToString(), r.b.CreatedAt, r.b.PartyEndsAt,
            PartyOf(r.p, r.VenueName, r.VenueArea), r.b.CheckedInCount, r.b.FirstCheckedInAt,
            HeldUntilShown(r.b), r.b.PerkTitle, r.b.PerkDiscount,
            r.b.IsActive ? r.b.DueFor(r.b.MainOutside, now) : 0, r.b.SkipLine,
            given.Where(g => g.BookingId == r.b.Id).Select(g => GuestPassOf(g, people)).ToList(),
            null, null));

        var guestRows = mine.Select(r => new BookingResponse(
            r.g.Id, r.b.PartyId, 1, r.b.PricePerGuest, GuestStatus(r.g, r.b), r.g.ClaimedAt ?? r.g.CreatedAt, r.b.PartyEndsAt,
            PartyOf(r.p, r.VenueName, r.VenueArea), r.g.CheckedInAt is null ? 0 : 1, r.g.CheckedInAt,
            HeldUntilShown(r.b), null, 0,
            r.g.CheckedInAt is null && r.g.RevokedAt is null && r.b.IsActive ? r.b.PricePerGuest : 0, false,
            [], r.g.Id, people.Get(r.b.UserId).First));

        return rows.Concat(guestRows).OrderByDescending(r => r.CreatedAt).ToList();
    }

    public GuestPassResponse GuestPassOf(GuestPass g, Dictionary<Guid, Person> people) =>
        new(g.Id, g.State, g.ClaimedByUserId is null ? null : people.Get(g.ClaimedByUserId).Short, links.Url(g.Token), g.CreatedAt);

    /// <summary>A guest pass is as good as its booking, unless it was taken back.</summary>
    public static string GuestStatus(GuestPass g, Booking b) => g.RevokedAt is not null ? nameof(BookingStatus.Cancelled) : b.Status.ToString();

    /// <summary>The hold, while it still matters: until someone on the booking is inside.</summary>
    public static DateTime? HeldUntilShown(Booking b) => b.CheckedInCount > 0 ? null : b.HeldUntil;

    private static BookingPartyResponse? PartyOf(Party? p, string? venueName, string? venueArea) =>
        p is null ? null : new BookingPartyResponse(p.Id, p.Title, p.ImageUrl, p.StartsAt, p.EndsAt, p.Latitude, p.Longitude,
            p.Genre, p.PerformerName, p.PerformerType, p.Status.ToString(), p.VenueId, venueName, venueArea);

    /// <summary>The party's bookings for its host: who, how many are in, the hold, and what is still to collect.</summary>
    public async Task<List<HostBookingResponse>> ForPartyAsync(Guid hostId, Guid partyId, CancellationToken ct = default)
    {
        await EnsureHostOwnsAsync(hostId, partyId, ct);
        var now = Now;
        var bookings = await db.Bookings.AsNoTracking().Where(b => b.PartyId == partyId).OrderByDescending(b => b.CreatedAt).ToListAsync(ct);
        var ids = bookings.Select(b => b.Id).ToList();
        var guestsWaiting = await db.Set<GuestPass>()
            .Where(g => ids.Contains(g.BookingId) && g.RevokedAt == null && g.CheckedInAt == null)
            .GroupBy(g => g.BookingId).Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.Key, g => g.Count, ct);
        var people = await People.ReadAsync(db, bookings.Select(b => b.UserId), ct);

        return bookings.Select(b => new HostBookingResponse(
            b.Id, b.PartyId, b.TicketCount, b.TotalPrice, b.Status.ToString(), b.CreatedAt, b.PartyEndsAt,
            people.Get(b.UserId).Short, b.CheckedInCount, HeldUntilShown(b),
            b.IsActive ? b.DueFor(b.MainOutside, now) + guestsWaiting.GetValueOrDefault(b.Id) * b.PricePerGuest : 0)).ToList();
    }

    private async Task EnsureHostOwnsAsync(Guid hostId, Guid partyId, CancellationToken ct)
    {
        var owner = await db.Parties.Where(p => p.Id == partyId).Select(p => (Guid?)p.HostId).FirstOrDefaultAsync(ct)
                    ?? throw ApiException.NotFound("Party");
        if (owner != hostId) throw ApiException.Forbidden();
    }
}

public static class BookingLocks
{
    /// <summary>
    /// Reads a booking and locks its row until the transaction ends (call it inside one). Every change to a booking's
    /// counts (scans, guest passes, cancelling, expiring) goes through this, so they happen one after another.
    /// </summary>
    public static async Task<Booking?> LockBookingAsync(this AppDbContext db, Guid bookingId, CancellationToken ct) =>
        (await db.Bookings.FromSql($"SELECT * FROM \"Bookings\" WHERE \"Id\" = {bookingId} FOR UPDATE").ToListAsync(ct)).SingleOrDefault();
}

/// <summary>The public link of a guest pass: /g/{token}.</summary>
public class GuestPassLinks(IHttpContextAccessor http, IConfiguration config)
{
    public string Url(string token)
    {
        var path = $"/g/{token}";
        if (http.HttpContext is { } context) return Links.PublicUrl(context, path);
        return (config["Public:BaseUrl"]?.TrimEnd('/') ?? "") + path;
    }
}
