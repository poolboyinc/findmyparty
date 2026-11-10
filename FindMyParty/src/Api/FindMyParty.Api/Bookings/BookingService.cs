using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using FindMyParty.Api.Parties;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace FindMyParty.Api.Bookings;

public class BookingService(AppDbContext db)
{
    /// <summary>Guests on one booking. One request can no longer take a whole venue.</summary>
    public const int MaxTicketsPerBooking = 6;

    /// <summary>
    /// Holds spots and records the booking in one transaction. Safe to retry with the same key:
    /// the same booking comes back and no extra spots are held.
    /// </summary>
    public async Task<Guid> CreateAsync(Guid userId, Guid partyId, int ticketCount, string idempotencyKey, CancellationToken ct = default)
    {
        if (ticketCount is < 1 or > MaxTicketsPerBooking)
            throw ApiException.Invalid($"A booking is for 1 to {MaxTicketsPerBooking} guests.", "ticket_count");
        if (idempotencyKey.Length > 100)
            throw ApiException.Invalid("Idempotency-Key is too long.", "idempotency_key");

        if (await FindByKeyAsync(userId, idempotencyKey, partyId, ticketCount, ct) is { } earlier) return earlier;

        await using var tx = await db.Database.BeginTransactionAsync(ct);

        // One statement decides who gets the last spots: it only updates if the party is open and has room.
        var now = DateTime.UtcNow;
        var held = await db.Parties
            .Where(p => p.Id == partyId && !p.IsDeleted && p.Status == PartyStatus.Published && p.EndsAt > now
                        && p.TicketsSold + ticketCount <= p.Capacity)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.TicketsSold, p => p.TicketsSold + ticketCount), ct);

        var party = await db.Parties.AsNoTracking()
            .Where(p => p.Id == partyId && !p.IsDeleted)
            .Select(p => new { p.Status, p.EndsAt, p.Price })
            .FirstOrDefaultAsync(ct) ?? throw ApiException.NotFound("Party");

        if (held == 0)
        {
            if (party.Status != PartyStatus.Published || party.EndsAt <= now)
                throw ApiException.Conflict("This party is not open for booking.", "not_bookable");
            throw ApiException.Conflict("Not enough spots left.", "sold_out");
        }

        var booking = new Booking(userId, partyId, ticketCount, party.Price, idempotencyKey, party.EndsAt);
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

    /// <summary>Cancels the guest's own booking and gives its spots back. Cancelling twice is harmless.</summary>
    public async Task CancelAsync(Guid userId, Guid bookingId, CancellationToken ct = default)
    {
        var booking = await db.Bookings.AsNoTracking()
            .Where(b => b.Id == bookingId)
            .Select(b => new { b.UserId, b.PartyId, b.TicketCount })
            .FirstOrDefaultAsync(ct) ?? throw ApiException.NotFound("Booking");
        if (booking.UserId != userId) throw ApiException.Forbidden();

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        // Only the request that actually flips the status releases the spots.
        var cancelled = await db.Bookings
            .Where(b => b.Id == bookingId && b.Status != BookingStatus.Cancelled)
            .ExecuteUpdateAsync(s => s.SetProperty(b => b.Status, BookingStatus.Cancelled), ct);
        if (cancelled == 1)
            await ReleaseAsync(booking.PartyId, booking.TicketCount, ct);
        await tx.CommitAsync(ct);
    }

    private Task ReleaseAsync(Guid partyId, int tickets, CancellationToken ct) =>
        db.Parties
            .Where(p => p.Id == partyId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.TicketsSold, p => p.TicketsSold >= tickets ? p.TicketsSold - tickets : 0), ct);

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
        }
    }

    public async Task<List<UserBookingResponse>> ForUserAsync(Guid userId, CancellationToken ct = default)
    {
        var rows = await (
            from b in db.Bookings
            where b.UserId == userId
            join p in db.Parties.Where(p => !p.IsDeleted) on b.PartyId equals p.Id into parties
            from p in parties.DefaultIfEmpty()
            orderby b.CreatedAt descending
            select new { b, p }).AsNoTracking().ToListAsync(ct);

        return rows.Select(r => new UserBookingResponse(
            r.b.Id, r.b.PartyId, r.b.TicketCount, r.b.TotalPrice, r.b.Status.ToString(), r.b.CreatedAt, r.b.PartyEndsAt,
            r.p is null ? null : new BookingPartyDto(r.p.Id, r.p.Title, r.p.ImageUrl, r.p.StartsAt, r.p.EndsAt, r.p.Latitude, r.p.Longitude,
                r.p.Genre, r.p.PerformerName, r.p.PerformerType, r.p.Status.ToString()))).ToList();
    }

    public async Task<List<BookingResponse>> ForPartyAsync(Guid hostId, Guid partyId, CancellationToken ct = default)
    {
        await EnsureHostOwnsAsync(hostId, partyId, ct);
        return await db.Bookings
            .Where(b => b.PartyId == partyId)
            .OrderByDescending(b => b.CreatedAt)
            .Select(b => new BookingResponse
            {
                Id = b.Id,
                PartyId = b.PartyId,
                TicketCount = b.TicketCount,
                TotalPrice = b.TotalPrice,
                Status = b.Status.ToString(),
                CreatedAt = b.CreatedAt,
                PartyEndsAt = b.PartyEndsAt
            })
            .ToListAsync(ct);
    }

    private async Task EnsureHostOwnsAsync(Guid hostId, Guid partyId, CancellationToken ct)
    {
        var owner = await db.Parties.Where(p => p.Id == partyId).Select(p => (Guid?)p.HostId).FirstOrDefaultAsync(ct)
                    ?? throw ApiException.NotFound("Party");
        if (owner != hostId) throw ApiException.Forbidden();
    }
}
