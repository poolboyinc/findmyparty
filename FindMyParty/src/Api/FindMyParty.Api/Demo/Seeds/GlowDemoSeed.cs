using FindMyParty.Api.Bookings;
using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using FindMyParty.Api.Glow;
using FindMyParty.Api.Parties;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Demo.Seeds;

/// <summary>
/// Glow for the demo (spec §2.9): perk switches at Monkey, Kula and Blok 5; the sponsored "First drink on VOLT" at Monkey;
/// Glow for every demo scan; and, with Seed:OwnerHistory and an owner, nine nights over the last three weekends so the
/// owner is Flame with about 1,240 Glow, a 3-week streak and a two-venue recap for last Friday.
/// </summary>
public class GlowDemoSeed(AppDbContext db, GlowService glow, IConfiguration config, ILogger<GlowDemoSeed> logger) : IDemoSeed
{
    public int Order => 30;

    public async Task SeedAsync(DemoContext demo, CancellationToken ct)
    {
        await SwitchPerksOnAsync(demo, ct);
        await EnsureVoltAsync(demo, ct);
        if (demo.OwnerId is { } owner && config.GetValue("Seed:OwnerHistory", true))
            await EnsureOwnerHistoryAsync(demo, owner, ct);

        await PayDemoScansAsync(demo, ct);
    }

    /// <summary>Glow for every demo scan that has none yet (also run last, by GlowCatchUpDemoSeed).</summary>
    public Task PayDemoScansAsync(DemoContext demo, CancellationToken ct)
    {
        var people = demo.Guests.Select(g => g.Id).ToList();
        if (demo.OwnerId is { } ownerId) people.Add(ownerId);
        return PayScansAsync(people, ct);
    }

    /// <summary>Created once; a host who later switches one off keeps it off.</summary>
    private async Task SwitchPerksOnAsync(DemoContext demo, CancellationToken ct)
    {
        (string Slug, string Kind)[] switches =
        [
            ("monkey", PerkKinds.FreeEntryBefore), ("kula", PerkKinds.FreeEntryBefore), ("blok-5", PerkKinds.FreeEntryBefore),
            ("monkey", PerkKinds.SkipLine), ("kula", PerkKinds.PlusOneFree),
        ];
        var perks = db.Set<VenuePerk>();
        for (var i = 0; i < switches.Length; i++)
        {
            var venueId = demo.VenueId(switches[i].Slug);
            var kind = switches[i].Kind;
            if (await perks.AnyAsync(p => p.VenueId == venueId && p.Kind == kind, ct)) continue;
            perks.Add(new VenuePerk
            {
                VenueId = venueId, Kind = kind, Enabled = true,
                UntilLocalTime = kind == PerkKinds.FreeEntryBefore ? FindMyParty.Api.Glow.PerkText.Midnight : null,
                UpdatedAt = demo.Now.AddMinutes(i - switches.Length), // lists show the venues in this order
            });
        }
        await db.SaveChangesAsync(ct);
    }

    /// <summary>"First drink on VOLT": Monkey, Flame and up, 400 Glow, 50 to give, renewed to run until tonight's party ends.</summary>
    private async Task EnsureVoltAsync(DemoContext demo, CancellationToken ct)
    {
        var id = demo.IdFor("perk:volt");
        var runningId = demo.RunningPartyId("monkey");
        var tonight = await db.Parties.Where(p => p.Id == runningId).Select(p => new { p.StartsAt, p.EndsAt }).FirstAsync(ct);
        var volt = await db.Set<SponsoredPerk>().FirstOrDefaultAsync(p => p.Id == id, ct);
        if (volt is null)
        {
            db.Set<SponsoredPerk>().Add(new SponsoredPerk
            {
                Id = id, Title = "First drink on VOLT", SponsorName = "VOLT", LogoText = "VOLT",
                ColorTop = "#ffd23c", ColorBottom = "#ff7a18", Ink = "#1a0a00",
                VenueId = demo.VenueId("monkey"), MinLevel = 3, GlowCost = 400, Stock = 50,
                StartsAt = tonight.StartsAt, EndsAt = tonight.EndsAt,
                CreatedByUserId = demo.OwnerId ?? demo.HostId("monkey"), Active = true,
            });
        }
        else if (volt.EndsAt < tonight.EndsAt)
        {
            volt.EndsAt = tonight.EndsAt;
        }
        await db.SaveChangesAsync(ct);
    }

    private record PastVenue(string Slug, string Party, string Genre, decimal Price);

    private static readonly Dictionary<string, PastVenue> Past = new()
    {
        ["monkey"] = new("monkey", "Neon Friday", "Techno", 5),
        ["kula"] = new("kula", "Rooftop Session", "House", 8),
        ["dr-house"] = new("dr-house", "Deep Cuts", "House", 5),
        ["blok-5"] = new("blok-5", "Balkan Bass", "Balkan", 3),
    };

    /// <summary>Weekend (0 = three weekends ago), Saturday?, venue, local scan time, scan on the day after the night's date?</summary>
    private static readonly (int Weekend, bool Saturday, string Slug, TimeOnly At, bool NextDay)[] OwnerNights =
    [
        (0, false, "monkey", new(23, 40), false),
        (0, true, "kula", new(0, 20), true),
        (1, false, "dr-house", new(23, 30), false),
        (1, true, "monkey", new(0, 30), true),
        (1, true, "blok-5", new(2, 0), true),
        (2, false, "monkey", new(23, 47), false),
        (2, false, "kula", new(1, 30), true),
        (2, true, "blok-5", new(23, 50), false),
        (2, true, "dr-house", new(2, 30), true),
    ];

    /// <summary>The owner's nine past nights: a booking scanned in at each, on a past party of that venue.</summary>
    private async Task EnsureOwnerHistoryAsync(DemoContext demo, Guid ownerId, CancellationToken ct)
    {
        var city = Cities.City.Default;
        var today = CityClock.NightDate(demo.Now, city);
        // The last weekend whose Saturday night is over.
        var lastFriday = GlowRules.FridayOf(today);
        if (today <= lastFriday.AddDays(1)) lastFriday = lastFriday.AddDays(-7);

        foreach (var n in OwnerNights)
        {
            var night = lastFriday.AddDays(7 * (n.Weekend - 2) + (n.Saturday ? 1 : 0));
            var at = CityClock.Utc((n.NextDay ? night.AddDays(1) : night).ToDateTime(n.At), city);
            var party = await PastPartyAsync(demo, Past[n.Slug], night, ct);
            await EnsureScannedBookingAsync(ownerId, party, at, demo.HostId(n.Slug), ct);
        }
    }

    /// <summary>The venue's party on that night (another seed's, when one is there), else one made here, 23:00–04:00 local.</summary>
    private async Task<Party> PastPartyAsync(DemoContext demo, PastVenue v, DateOnly night, CancellationToken ct)
    {
        var city = Cities.City.Default;
        var venueId = demo.VenueId(v.Slug);
        var from = CityClock.Utc(night.ToDateTime(new TimeOnly(18, 0)), city);
        var to = CityClock.Utc(night.AddDays(1).ToDateTime(new TimeOnly(CityClock.NightEndsAtHour, 0)), city);
        var existing = await db.Parties
            .Where(p => p.VenueId == venueId && p.Status == PartyStatus.Published && !p.IsDeleted && p.StartsAt >= from && p.StartsAt < to)
            .OrderBy(p => p.StartsAt).FirstOrDefaultAsync(ct);
        if (existing is not null) return existing;

        var venue = await db.VenueProfiles.Where(x => x.Id == venueId).Select(x => new { x.Latitude, x.Longitude }).FirstAsync(ct);
        var party = new Party(demo.HostId(v.Slug), venueId, new PartyRequest
        {
            Title = v.Party, Description = $"{v.Genre} at a demo venue. Demo party.", Price = v.Price, Capacity = 300,
            StartsAt = CityClock.Utc(night.ToDateTime(new TimeOnly(23, 0)), city),
            EndsAt = CityClock.Utc(night.AddDays(1).ToDateTime(new TimeOnly(4, 0)), city),
            Latitude = venue.Latitude, Longitude = venue.Longitude, Genre = v.Genre,
        });
        party.PublishNow();
        db.Parties.Add(party);
        await db.SaveChangesAsync(ct);
        return party;
    }

    private async Task EnsureScannedBookingAsync(Guid userId, Party party, DateTime at, Guid doorId, CancellationToken ct)
    {
        var key = $"glow-owner-{party.Id:N}";
        if (await db.Bookings.AnyAsync(b => b.UserId == userId && b.IdempotencyKey == key, ct)) return;

        var booking = new Booking(userId, party.Id, 1, party.Price, key, party.EndsAt);
        db.Bookings.Add(booking);
        db.Entry(booking).Property(b => b.CheckedInCount).CurrentValue = 1;
        db.Entry(booking).Property(b => b.FirstCheckedInAt).CurrentValue = at;
        db.Entry(booking).Property(b => b.Status).CurrentValue = BookingStatus.Confirmed;
        db.CheckIns.Add(new CheckIn { Id = Guid.NewGuid(), BookingId = booking.Id, PartyId = party.Id, Admitted = 1, At = at, ByUserId = doorId, GuestUserId = userId });
        await db.SaveChangesAsync(ct);
        var partyId = party.Id;
        await db.Parties.Where(p => p.Id == partyId && p.TicketsSold < p.Capacity)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.TicketsSold, p => p.TicketsSold + 1), ct);
    }

    /// <summary>Glow for every scan of these people that has none yet, oldest first, without pushes.</summary>
    private async Task PayScansAsync(List<Guid> people, CancellationToken ct)
    {
        var scans = await (
            from c in db.CheckIns
            where people.Contains(c.GuestUserId)
            where !db.Set<GlowEntry>().Any(e => e.UserId == c.GuestUserId && e.BookingId == c.BookingId && e.Kind == GlowKinds.Scan)
            join p in db.Parties on c.PartyId equals p.Id
            select new { c.Id, c.BookingId, c.PartyId, p.VenueId, c.GuestUserId, c.Admitted, c.At })
            .AsNoTracking().ToListAsync(ct);

        var paid = 0;
        foreach (var first in scans.GroupBy(s => (s.BookingId, s.GuestUserId)).Select(g => g.MinBy(s => s.At)!).OrderBy(s => s.At))
        {
            var e = new CheckInEvent(first.Id, first.BookingId, first.PartyId, first.VenueId, first.GuestUserId, first.Admitted, first.At, FirstForGuest: true);
            if (await glow.AwardAsync(e, push: false, ct) is not null) paid++;
        }
        if (paid > 0) logger.LogInformation("Demo Glow paid for {Count} scans", paid);
    }
}

/// <summary>
/// Runs after every other demo seed: the friends' and other later seeds' scans get their Glow in the same
/// round, not half an hour later.
/// </summary>
public class GlowCatchUpDemoSeed(AppDbContext db, GlowService glow, IConfiguration config, ILogger<GlowDemoSeed> logger) : IDemoSeed
{
    public int Order => 1000;

    public Task SeedAsync(DemoContext demo, CancellationToken ct) =>
        new GlowDemoSeed(db, glow, config, logger).PayDemoScansAsync(demo, ct);
}
