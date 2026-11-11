using FindMyParty.Api.Cities;
using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Glow;

/// <summary>Glow earned at the door, and the guest's standing: level, streak, badges, last nights.</summary>
public class GlowService(AppDbContext db, INotifier notifier, IGuestPassIds guestPasses, ILogger<GlowService> logger)
{
    private DbSet<GlowEntry> Entries => db.Set<GlowEntry>();

    // ── earning ──

    /// <summary>
    /// Pays the guest for a scan (spec §2.3 "Glow") and the one who invited them for their first. Only the first scan that
    /// lets this guest's pass in pays; a second scan of the same booking, or the same scan told twice, pays nothing.
    /// Returns the award, or null when nothing was paid. `push` is off for demo data.
    /// </summary>
    public async Task<GlowAward?> AwardAsync(CheckInEvent e, bool push, CancellationToken ct)
    {
        if (!e.FirstForGuest) return null;
        var guest = e.GuestUserId;
        if (await Entries.AnyAsync(x => x.UserId == guest && x.BookingId == e.BookingId && x.Kind == GlowKinds.Scan, ct)) return null;

        var venue = e.VenueId is { } venueId
            ? await db.VenueProfiles.Where(v => v.Id == venueId).Select(v => new { v.VenueName, v.CitySlug }).FirstOrDefaultAsync(ct)
            : null;
        var city = venue?.CitySlug ?? City.Default;
        var night = CityClock.NightDate(e.At, city);

        var earlier = await Entries
            .Where(x => x.UserId == guest && x.Kind == GlowKinds.Scan)
            .Select(x => new { x.NightDate, x.VenueId, x.At })
            .ToListAsync(ct);
        var everScanned = earlier.Count > 0;
        var prior = earlier.Where(x => x.At <= e.At).ToList();

        var parts = new List<(string Kind, int Points)> { (GlowKinds.Scan, GlowRules.ScanPoints) };
        if (GlowRules.IsBeforeMidnight(CityClock.Local(e.At, city)))
            parts.Add((GlowKinds.BeforeMidnight, GlowRules.BeforeMidnightPoints));
        if (e.VenueId is not null && prior.All(x => x.VenueId != e.VenueId))
            parts.Add((GlowKinds.FirstAtVenue, GlowRules.FirstAtVenuePoints));

        var streak = GlowRules.Streak(prior.Select(x => x.NightDate).Append(night), night);
        var firstThisWeekend = CityClock.IsWeekendNight(night)
            && !prior.Any(x => CityClock.IsWeekendNight(x.NightDate) && GlowRules.FridayOf(x.NightDate) == GlowRules.FridayOf(night));
        if (firstThisWeekend && streak >= GlowRules.StreakPaysFromWeek)
            parts.Add((GlowKinds.Streak, GlowRules.StreakPoints));
        if (streak >= GlowRules.MultiplierFromWeek)
            parts.Add((GlowKinds.Multiplier, (int)Math.Round(parts.Sum(p => p.Points) / 2.0, MidpointRounding.AwayFromZero)));

        var total = parts.Sum(p => p.Points);
        var entries = parts.Select(p => Entry(guest, p.Kind, p.Points, e, night)).ToList();

        // The invitee's first scan ever pays whoever invited them.
        Guid? inviter = null;
        if (!everScanned)
        {
            var guestId = guest.ToString();
            var referredBy = await db.Users.Where(u => u.Id == guestId).Select(u => u.ReferredByUserId).FirstOrDefaultAsync(ct);
            if (Guid.TryParse(referredBy, out var by) && by != guest && await db.Users.AnyAsync(u => u.Id == referredBy, ct))
                inviter = by;
        }

        await using (var tx = await db.Database.BeginTransactionAsync(ct))
        {
            Entries.AddRange(entries);
            if (inviter is { } invitedBy) Entries.Add(Entry(invitedBy, GlowKinds.Referral, GlowRules.ReferralPoints, e, night));
            try
            {
                await db.SaveChangesAsync(ct);
            }
            catch (DbUpdateException ex)
            {
                // The same scan was paid a moment ago by another copy of this listener.
                logger.LogInformation(ex, "Glow for booking {BookingId} was already paid", e.BookingId);
                return null;
            }
            await AddToTotalsAsync(guest, total, ct);
            if (inviter is { } paid) await AddToTotalsAsync(paid, GlowRules.ReferralPoints, ct);
            await tx.CommitAsync(ct);
        }

        var award = new GlowAward(e.BookingId, e.At, e.VenueId, venue?.VenueName, total,
            parts.Select(p => new GlowPart(p.Kind, p.Points, GlowKinds.Label(p.Kind))).ToList(), streak);

        if (push)
        {
            // A guest-pass holder's phone knows the pass by the guest pass id: the push names that.
            if (!await db.Bookings.AnyAsync(b => b.Id == e.BookingId && b.UserId == guest, ct)
                && await guestPasses.GuestPassIdAsync(e.BookingId, guest, ct) is { } guestPassId)
                award = award with { BookingId = guestPassId };
            var where = venue is null ? "" : $" at {venue.VenueName}";
            await notifier.SendAsync(new Push([guest], "scanned", "You're in.", $"+{GlowRules.Points(total)} Glow{where}",
                new ScannedPushData(award.BookingId, award), NotifyCategory.Transactional), CancellationToken.None);
            if (inviter is { } told)
            {
                var name = await GuestFirstNameAsync(guest, ct);
                await notifier.SendAsync(new Push([told], "referral", $"+{GlowRules.ReferralPoints} Glow", $"{name}'s first night out",
                    new { }, NotifyCategory.Friends), CancellationToken.None);
            }
        }
        return award;
    }

    private static GlowEntry Entry(Guid userId, string kind, int points, CheckInEvent e, DateOnly night) => new()
    {
        Id = Guid.NewGuid(), UserId = userId, Kind = kind, Points = points,
        BookingId = e.BookingId, VenueId = e.VenueId, PartyId = e.PartyId, At = e.At, NightDate = night
    };

    /// <summary>Earning moves lifetime and balance together.</summary>
    private Task<int> AddToTotalsAsync(Guid userId, int points, CancellationToken ct)
    {
        var id = userId.ToString();
        return db.Users.Where(u => u.Id == id).ExecuteUpdateAsync(s => s
            .SetProperty(u => u.GlowLifetime, u => u.GlowLifetime + points)
            .SetProperty(u => u.GlowBalance, u => u.GlowBalance + points), ct);
    }

    private async Task<string> GuestFirstNameAsync(Guid userId, CancellationToken ct)
    {
        var id = userId.ToString();
        var user = await db.Users.Where(u => u.Id == id).Select(u => new { u.DisplayName, u.UserName }).FirstOrDefaultAsync(ct);
        var name = PersonName.Display(user?.DisplayName, user?.UserName);
        return name.Split(' ', StringSplitOptions.RemoveEmptyEntries)[0];
    }

    // ── referral ──

    /// <summary>How long after joining a new account may still name who invited it.</summary>
    public static readonly TimeSpan ReferrerWindow = TimeSpan.FromDays(7);

    /// <summary>
    /// Records who invited this account. Only once, only before its first scan, and only in its first seven days.
    /// </summary>
    public async Task SetReferrerAsync(Guid userId, string? handle, DateTime now, CancellationToken ct)
    {
        var name = handle?.Trim().TrimStart('@') ?? "";
        var normalized = name.ToUpperInvariant();
        var inviter = name.Length == 0 ? null
            : await db.Users.Where(u => u.NormalizedUserName == normalized).Select(u => u.Id).FirstOrDefaultAsync(ct);
        if (inviter is null) throw new ApiException(StatusCodes.Status404NotFound, "Nobody has that handle.", "referrer_unknown");

        var id = userId.ToString();
        if (inviter == id) throw ApiException.Invalid("You cannot invite yourself.", "referrer_self");

        var user = await db.Users.Where(u => u.Id == id).Select(u => new { u.ReferredByUserId, u.CreatedAt }).FirstOrDefaultAsync(ct)
                   ?? throw ApiException.NotFound("Account");
        var scanned = await db.CheckIns.AnyAsync(c => c.GuestUserId == userId, ct)
                      || await Entries.AnyAsync(x => x.UserId == userId && x.Kind == GlowKinds.Scan, ct);
        if (user.ReferredByUserId is not null || scanned || now - user.CreatedAt > ReferrerWindow)
            throw ApiException.Conflict("It is too late to name who invited you.", "referrer_late");

        // Re-checked by the database, so two answers at once cannot both be recorded.
        if (await db.Users.Where(u => u.Id == id && u.ReferredByUserId == null)
                .ExecuteUpdateAsync(s => s.SetProperty(u => u.ReferredByUserId, inviter), ct) == 0)
            throw ApiException.Conflict("It is too late to name who invited you.", "referrer_late");
    }

    // ── reading ──

    /// <summary>
    /// What one scan paid, as the flare shows it, by booking id or (for a guest-pass holder) guest pass id; the answer
    /// carries the id it was asked with. Null until the scan has been paid.
    /// </summary>
    public async Task<GlowAward?> AwardForAsync(Guid userId, Guid id, CancellationToken ct)
    {
        if (await AwardForBookingAsync(userId, id, ct) is { } award) return award;
        return await guestPasses.BookingIdAsync(id, userId, ct) is { } bookingId
               && await AwardForBookingAsync(userId, bookingId, ct) is { } held
            ? held with { BookingId = id }
            : null;
    }

    private async Task<GlowAward?> AwardForBookingAsync(Guid userId, Guid bookingId, CancellationToken ct)
    {
        var parts = await Entries
            .Where(x => x.UserId == userId && x.BookingId == bookingId && GlowKinds.ScanParts.Contains(x.Kind))
            .ToListAsync(ct);
        var scan = parts.FirstOrDefault(p => p.Kind == GlowKinds.Scan);
        if (scan is null) return null;

        var nights = await Entries.Where(x => x.UserId == userId && x.Kind == GlowKinds.Scan && x.At <= scan.At)
            .Select(x => x.NightDate).ToListAsync(ct);
        var venueName = scan.VenueId is { } venueId
            ? await db.VenueProfiles.Where(v => v.Id == venueId).Select(v => v.VenueName).FirstOrDefaultAsync(ct)
            : null;
        var ordered = parts.OrderBy(p => Array.IndexOf(GlowKinds.ScanParts, p.Kind))
            .Select(p => new GlowPart(p.Kind, p.Points, GlowKinds.Label(p.Kind))).ToList();
        return new GlowAward(bookingId, scan.At, scan.VenueId, venueName, ordered.Sum(p => p.Points), ordered,
            GlowRules.Streak(nights, scan.NightDate));
    }

    public async Task<GlowSummary> SummaryAsync(Guid userId, DateTime now, CancellationToken ct)
    {
        var id = userId.ToString();
        var user = await db.Users.Where(u => u.Id == id)
            .Select(u => new { u.GlowLifetime, u.GlowBalance, u.HomeCity }).FirstOrDefaultAsync(ct)
            ?? throw ApiException.NotFound("Account");
        var entries = await Entries.Where(x => x.UserId == userId).AsNoTracking().ToListAsync(ct);

        var scans = entries.Where(x => x.Kind == GlowKinds.Scan).ToList();
        var nights = scans.Select(x => x.NightDate).ToList();
        var today = CityClock.NightDate(now, user.HomeCity);
        var streak = GlowRules.Streak(nights, today);
        var venuesLit = scans.Where(x => x.VenueId is not null).Select(x => x.VenueId!.Value).Distinct().ToList();
        var nightsOut = nights.Distinct().Count();
        var earlyScans = entries.Count(x => x.Kind == GlowKinds.BeforeMidnight);
        var referrals = entries.Count(x => x.Kind == GlowKinds.Referral);
        var regular = GlowRules.BestStreak(nights) >= GlowRules.MultiplierFromWeek;

        var badges = new List<GlowBadge>
        {
            Badge("first-night", "First night", "Your first night out", nightsOut, 1),
            Badge("before-midnight", "Before midnight", "Scanned in before midnight", earlyScans, 1),
            Badge("explorer", "Explorer", "Five venues lit", venuesLit.Count, 5),
            Badge("brought-a-friend", "Brought a friend", "Someone you invited went out", referrals, 1),
            Badge("regular", "Regular", "Four weekends in a row", regular ? GlowRules.MultiplierFromWeek : streak, GlowRules.MultiplierFromWeek),
        };

        var last = scans.OrderByDescending(x => x.At).Take(12).ToList();
        var venueIds = last.Where(x => x.VenueId is not null).Select(x => x.VenueId!.Value).Distinct().ToList();
        var names = await db.VenueProfiles.Where(v => venueIds.Contains(v.Id)).ToDictionaryAsync(v => v.Id, v => v.VenueName, ct);
        var pointsByBooking = entries.Where(x => x.BookingId is not null && GlowKinds.ScanParts.Contains(x.Kind))
            .GroupBy(x => x.BookingId!.Value).ToDictionary(g => g.Key, g => g.Sum(x => x.Points));
        var lastNights = last.Select(x =>
        {
            var venueName = x.VenueId is { } v ? names.GetValueOrDefault(v) : null;
            return new GlowNight(x.BookingId ?? x.Id, x.NightDate, x.At, venueName is null ? "Scanned in" : $"Scanned in at {venueName}",
                venueName, pointsByBooking.GetValueOrDefault(x.BookingId ?? Guid.Empty));
        }).ToList();

        var (level, next, toNext, ring, ladder) = Standing(user.GlowLifetime);
        return new GlowSummary(user.GlowLifetime, user.GlowBalance, level, next, toNext, ring, ladder,
            GlowLevels.All.Select(l => new LevelStep(l.Name, l.Min)).ToList(),
            streak, GlowRules.MultiplierFromWeek, nightsOut, venuesLit.Count, venuesLit, badges, lastNights);
    }

    private static GlowBadge Badge(string id, string label, string hint, int have, int need) =>
        new(id, label, hint, have >= need, Math.Min(have, need), need);

    /// <summary>Where a lifetime total stands: the level, the next one, and the ring and ladder fractions.</summary>
    public static (LevelRef Level, NextLevelRef? Next, int? ToNext, double Ring, double Ladder) Standing(int lifetime)
    {
        var level = GlowLevels.For(lifetime);
        var index = level.Number - 1;
        var top = GlowLevels.All.Count - 1;
        if (level.Next is not { } nextMin)
            return (new LevelRef(level.Name, level.Number, level.Min), null, null, 1, 1);

        var next = GlowLevels.ByNumber(level.Number + 1);
        var progress = (double)(lifetime - level.Min) / (nextMin - level.Min);
        return (new LevelRef(level.Name, level.Number, level.Min), new NextLevelRef(next.Name, next.Min), nextMin - lifetime,
            Math.Round((double)lifetime / nextMin, 4), Math.Round((index + progress) / top, 4));
    }
}
