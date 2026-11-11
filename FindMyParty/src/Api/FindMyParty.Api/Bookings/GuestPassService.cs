using System.Security.Cryptography;
using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using FindMyParty.Api.Parties;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Bookings;

/// <summary>"Send to a guest": a link worth one spot of a booking. Whoever takes it gets their own code and pays their own entry.</summary>
public class GuestPassService(AppDbContext db, TimeProvider time, BookingService bookings, INotifier notifier)
{
    private DateTime Now => time.GetUtcNow().UtcDateTime;

    /// <summary>
    /// The booker hands out one spot. The booker always keeps a spot of their own until they are inside:
    /// at least two spots left to give before that, one after.
    /// </summary>
    public async Task<GuestPassResponse> CreateAsync(Guid userId, Guid bookingId, CancellationToken ct = default)
    {
        var now = Now;
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var booking = await db.LockBookingAsync(bookingId, ct) ?? throw ApiException.NotFound("Booking");
        if (booking.UserId != userId) throw ApiException.Forbidden();
        await CheckOpenAsync(booking, now, ct);

        var keep = booking.MainAdmitted > 0 ? 0 : 1;
        if (booking.MainOutside - keep < 1)
            throw ApiException.Conflict("There is no spare spot on this pass.", "no_spot_to_give");

        var pass = new GuestPass
        {
            Id = Guid.NewGuid(), BookingId = booking.Id, Token = NewToken(), PassSecret = PassCode.NewSecret(), CreatedAt = now
        };
        db.Set<GuestPass>().Add(pass);
        booking.AddGuestSpot();
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return bookings.GuestPassOf(pass, []);
    }

    private static string NewToken() => Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();

    /// <summary>The booking can still be shared: active, its hold not over, its party on and not ended.</summary>
    private async Task CheckOpenAsync(Booking booking, DateTime now, CancellationToken ct)
    {
        if (booking.Status == BookingStatus.Cancelled) throw ApiException.Conflict("This booking was cancelled.", "booking_cancelled");
        if (booking.Status == BookingStatus.Expired || booking.HoldOverAt(now)) throw PassService.HoldExpired(booking.HeldUntil);
        var party = await db.Parties.AsNoTracking().Where(p => p.Id == booking.PartyId).Select(p => new { p.Status, p.EndsAt, p.IsDeleted }).FirstAsync(ct);
        if (party.IsDeleted || party.Status == PartyStatus.Cancelled) throw ApiException.Conflict("This party was cancelled.", "party_cancelled");
        if (now > party.EndsAt) throw ApiException.Conflict("This party is over.", "party_over");
    }

    /// <summary>
    /// The booker takes a guest pass back, or its holder gives it back. The spot returns to the booker's own pass.
    /// A guest who is already inside cannot be taken back.
    /// </summary>
    public async Task RevokeAsync(Guid userId, Guid guestPassId, CancellationToken ct = default)
    {
        var bookingId = await db.Set<GuestPass>().Where(g => g.Id == guestPassId).Select(g => (Guid?)g.BookingId).FirstOrDefaultAsync(ct)
                        ?? throw ApiException.NotFound("Guest pass");

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var booking = await db.LockBookingAsync(bookingId, ct) ?? throw ApiException.NotFound("Guest pass");
        var pass = await db.Set<GuestPass>().FirstAsync(g => g.Id == guestPassId, ct);
        if (booking.UserId != userId && pass.ClaimedByUserId != userId) throw ApiException.Forbidden();
        if (pass.RevokedAt is not null) return;
        if (pass.CheckedInAt is not null) throw BookingService.GuestInside();

        pass.RevokedAt = Now;
        booking.RemoveGuestSpot();
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    private record Found(GuestPass Pass, Booking Booking, string PartyTitle, string? PartyImage, string? VenueName, DateTime StartsAt, DateTime EndsAt, PartyStatus PartyStatus);

    private async Task<Found?> FindAsync(string? token, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length > 32) return null;
        var t = token.Trim().ToLowerInvariant();
        return await (
            from g in db.Set<GuestPass>()
            where g.Token == t
            join b in db.Bookings on g.BookingId equals b.Id
            join p in db.Parties on b.PartyId equals p.Id
            join v in db.VenueProfiles on p.VenueId equals (Guid?)v.Id into venues
            from v in venues.DefaultIfEmpty()
            select new Found(g, b, p.Title, p.ImageUrl, (string?)v.VenueName, p.StartsAt, p.EndsAt, p.Status)).AsNoTracking().FirstOrDefaultAsync(ct);
    }

    /// <summary>What a link shows before anyone signs in: the party, who sent it, and whether it can still be taken.</summary>
    public async Task<GuestPassPreview> PreviewAsync(string? token, CancellationToken ct = default)
    {
        var found = await FindAsync(token, ct) ?? throw ApiException.NotFound("Guest pass");
        var sender = await People.ReadAsync(db, found.Booking.UserId, ct);
        return new GuestPassPreview(found.PartyTitle, found.VenueName, found.StartsAt, sender.First, PreviewStatus(found, Now));
    }

    private static string PreviewStatus(Found f, DateTime now) =>
        f.Pass.RevokedAt is not null || !f.Booking.IsActive || f.Booking.HoldOverAt(now) || f.PartyStatus == PartyStatus.Cancelled || now > f.EndsAt ? "gone"
        : f.Pass.ClaimedByUserId is not null ? "taken"
        : "open";

    /// <summary>For the share page: the sender's first name and the party, or null for an unknown link.</summary>
    public async Task<(string Sender, string PartyTitle, string? VenueName, string? ImageUrl)?> ShareAsync(string? token, CancellationToken ct = default)
    {
        var found = await FindAsync(token, ct);
        if (found is null) return null;
        var sender = await People.ReadAsync(db, found.Booking.UserId, ct);
        return (sender.First, found.PartyTitle, found.VenueName, found.PartyImage);
    }

    /// <summary>A signed-in guest takes the pass. Taking it again is harmless; nobody else can.</summary>
    public async Task<BookingResponse> ClaimAsync(Guid userId, string? token, CancellationToken ct = default)
    {
        var found = await FindAsync(token, ct) ?? throw ApiException.NotFound("Guest pass");
        var now = Now;

        await using (var tx = await db.Database.BeginTransactionAsync(ct))
        {
            var booking = await db.LockBookingAsync(found.Booking.Id, ct) ?? throw ApiException.NotFound("Guest pass");
            var pass = await db.Set<GuestPass>().FirstAsync(g => g.Id == found.Pass.Id, ct);
            if (pass.ClaimedByUserId == userId) return await RowAsync(userId, pass.Id, ct);
            if (pass.RevokedAt is not null) throw ApiException.NotFound("Guest pass");
            if (booking.UserId == userId) throw ApiException.Conflict("This is your own pass.", "guest_pass_own");
            if (pass.ClaimedByUserId is not null) throw ApiException.Conflict("Someone already took this pass.", "guest_pass_taken");
            if (found.PartyStatus == PartyStatus.Cancelled || now > found.EndsAt) throw ApiException.Conflict("This party is over.", "party_over");
            if (!booking.IsActive || booking.HoldOverAt(now)) throw ApiException.NotFound("Guest pass");
            if (await db.Set<GuestPass>().AnyAsync(g => g.BookingId == booking.Id && g.ClaimedByUserId == userId && g.RevokedAt == null, ct))
                throw ApiException.Conflict("You already have a pass on this booking.", "guest_pass_own");

            pass.ClaimedByUserId = userId;
            pass.ClaimedAt = now;
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }

        var guest = await People.ReadAsync(db, userId, ct);
        await notifier.SendAsync(new Push([found.Booking.UserId], "guest_pass_claimed", $"{guest.First} took your guest pass", found.PartyTitle,
            new { bookingId = found.Booking.Id }), ct);
        return await RowAsync(userId, found.Pass.Id, ct);
    }

    private async Task<BookingResponse> RowAsync(Guid userId, Guid guestPassId, CancellationToken ct) =>
        (await bookings.ForUserAsync(userId, ct)).First(r => r.GuestPassId == guestPassId);
}
