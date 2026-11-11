using System.Text.Json;
using FindMyParty.Api.Bookings;
using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using FindMyParty.Api.Parties;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Demo.Seeds;

/// <summary>
/// What the demo venues look like and what they have done: kind, area and building (measured on the map),
/// line-ups with set times, age limits, a free Thursday "Student Night" at Monkey, and six weeks of past nights
/// with bookings and door scans shaped like a real night (few at the start, most around 01:00 UTC), so the
/// hour chart has a "usual" and hosts have past nights.
/// </summary>
public class VenueDemoSeed(AppDbContext db) : IDemoSeed
{
    public int Order => 10;

    private record Act(string Name, string Role, double Hours);

    private record Look(string Slug, string Kind, string Area, double HeightM, double[][] Ring, Act[] Acts, int? AgeLimit,
        string FridayTitle, string SaturdayTitle, string Genre, decimal Price, int Capacity, int NightGuests);

    // Rings and heights copied from design-proposals/data/demo-footprints.json ([lng, lat], closed).
    private static readonly Look[] Looks =
    [
        new("monkey", "Club", "Stara Varoš", 18,
            [[19.263302, 42.440698], [19.263834, 42.44054], [19.263806, 42.440487], [19.263778, 42.440437], [19.263537, 42.440509], [19.263398, 42.44055], [19.263311, 42.44039], [19.26316, 42.440436], [19.263302, 42.440698]],
            [new("Lena K", "DJ", 0), new("DJ Proximus", "DJ", 2)], 18, "Neon Friday", "House Arrest", "Techno", 5, 300, 220),
        new("kula", "Rooftop", "Centar", 20,
            [[19.264829, 42.441337], [19.265134, 42.441248], [19.265074, 42.441133], [19.264768, 42.441222], [19.264812, 42.441302], [19.264829, 42.441337]],
            [new("Sunset Selectors", "DJ", 0), new("Lena K", "DJ", 2)], 18, "Rooftop Session", "Sunset Disco", "House", 8, 220, 160),
        new("dr-house", "Bar", "Centar", 16,
            [[19.262019, 42.440977], [19.262745, 42.440769], [19.262719, 42.44072], [19.262692, 42.440667], [19.261965, 42.440876], [19.262019, 42.440977]],
            [new("VRT", "DJ", 0), new("Deep Room", "DJ", 2)], null, "Deep Cuts", "Vinyl Only", "House", 5, 200, 120),
        new("blok-5", "Club", "Blok 5", 16,
            [[19.263124, 42.440047], [19.263495, 42.439937], [19.263523, 42.439929], [19.263466, 42.439823], [19.263437, 42.439832], [19.263248, 42.439888], [19.263067, 42.439941], [19.263124, 42.440047]],
            [new("Trio Morača", "Band", 0), new("DJ Ćale", "DJ", 2.5)], null, "Balkan Bass", "Trubači Night", "Balkan", 3, 150, 90),
        new("neon-basta", "Garden", "Zabjelo", 15,
            [[19.264214, 42.442239], [19.264349, 42.442199], [19.264172, 42.441875], [19.264037, 42.441916], [19.264214, 42.442239]],
            [new("Ana & Band", "Band", 0)], null, "Garden Live", "Acoustic Sunday", "Live", 0, 120, 60),
        new("hangar-7", "Warehouse", "Stari Aerodrom", 14,
            [[19.262283, 42.442138], [19.26279, 42.44198], [19.262725, 42.441867], [19.26257, 42.441916], [19.262492, 42.44194], [19.262446, 42.441953], [19.262394, 42.44197], [19.262299, 42.442], [19.262218, 42.442025], [19.262283, 42.442138]],
            [new("Kontra", "DJ", 0), new("Nox", "DJ", 3)], 18, "Warehouse", "Raw Cuts", "Techno", 6, 100, 50),
        new("atlas", "Club", "Preko Morače", 20,
            [[19.264799, 42.440214], [19.265409, 42.440029], [19.265339, 42.439902], [19.264728, 42.440086], [19.264799, 42.440214]],
            [new("DJ Mila", "DJ", 0)], null, "Ladies Night", "Throwback Thursday", "Pop", 0, 80, 30),
    ];

    private const int PastWeeks = 6;
    private const int NamedGuests = 6; // Mila … Jovana: placed by the friends seed, never given demo bookings here

    /// <summary>The past party of a demo venue on a night (a local date), if this seed made one. Other seeds may book onto it.</summary>
    public static Guid PastPartyId(string slug, DateOnly night) => DemoContext.Id($"venue-seed:past:{slug}:{night:yyyy-MM-dd}");

    /// <summary>The nights this seed fills: the last six Fridays and Saturdays, and the last six of tonight's weekday.</summary>
    public static IEnumerable<DateOnly> PastNights(DateOnly tonight) =>
        Enumerable.Range(1, PastWeeks * 7).Select(days => tonight.AddDays(-days))
            .Where(d => d.DayOfWeek is DayOfWeek.Friday or DayOfWeek.Saturday || d.DayOfWeek == tonight.DayOfWeek);

    public async Task SeedAsync(DemoContext demo, CancellationToken ct)
    {
        foreach (var look in Looks)
        {
            var venueId = demo.VenueId(look.Slug);
            await db.VenueProfiles.Where(v => v.Id == venueId).ExecuteUpdateAsync(s => s
                .SetProperty(v => v.Kind, look.Kind)
                .SetProperty(v => v.Area, look.Area)
                .SetProperty(v => v.Footprint, JsonSerializer.Serialize(look.Ring, (JsonSerializerOptions?)null))
                .SetProperty(v => v.BuildingHeightM, look.HeightM), ct);

            await StudentNightAsync(demo, look, ct);
            await PastNightsAsync(demo, look, ct);
            await LineUpsAsync(demo, look, ct);
        }
    }

    /// <summary>Acts and age limit on every party of the venue that does not have a line-up yet.</summary>
    private async Task LineUpsAsync(DemoContext demo, Look look, CancellationToken ct)
    {
        var venueId = demo.VenueId(look.Slug);
        var parties = await db.Parties
            .Where(p => p.VenueId == venueId && !p.IsDeleted && p.Status == PartyStatus.Published && !db.Set<PartyAct>().Any(a => a.PartyId == p.Id))
            .ToListAsync(ct);
        foreach (var party in parties)
        {
            var acts = party.Title == StudentNightTitle ? [new Act("Student DJs", "DJ", 0)] : look.Acts;
            var order = 0;
            foreach (var act in acts.Where(a => party.StartsAt.AddHours(a.Hours) < party.EndsAt))
                db.Set<PartyAct>().Add(new PartyAct { Id = Guid.NewGuid(), PartyId = party.Id, Name = act.Name, Role = act.Role, StartsAt = party.StartsAt.AddHours(act.Hours), Order = order++ });
            party.SetHeadliner(acts[0].Name, acts[0].Role);
            if (party.AgeLimit is null && look.AgeLimit is { } age) party.SetAgeLimit(age);
        }
        await db.SaveChangesAsync(ct);
        db.ChangeTracker.Clear();
    }

    private const string StudentNightTitle = "Student Night";

    /// <summary>Monkey's free Thursday, the next one that does not overlap tonight's party.</summary>
    private async Task StudentNightAsync(DemoContext demo, Look look, CancellationToken ct)
    {
        if (look.Slug != "monkey") return;
        var now = demo.Now;
        var thursday = now.Date.AddDays(((int)DayOfWeek.Thursday - (int)now.DayOfWeek + 7) % 7).AddHours(22);
        if (thursday <= now.AddHours(13)) thursday = thursday.AddDays(7);
        var id = demo.IdFor($"venue-seed:student-night:{thursday:yyyy-MM-dd}");
        if (await db.Parties.AnyAsync(p => p.Id == id, ct)) return;

        var venue = await db.VenueProfiles.AsNoTracking().FirstAsync(v => v.Id == demo.VenueId(look.Slug), ct);
        var party = new Party(id, demo.HostId(look.Slug), venue.Id, new PartyRequest
        {
            Title = StudentNightTitle, Description = "Pop at Monkey. Free with a student card. Demo party.", Price = 0, Capacity = look.Capacity,
            StartsAt = thursday, EndsAt = thursday.AddHours(5), Latitude = venue.Latitude, Longitude = venue.Longitude, Genre = "Pop",
        });
        party.PublishNow();
        db.Parties.Add(party);
        await db.SaveChangesAsync(ct);
        db.ChangeTracker.Clear();
    }

    /// <summary>Ended parties (22:00–03:00 UTC) with bookings and scans. A night already there is left alone.</summary>
    private async Task PastNightsAsync(DemoContext demo, Look look, CancellationToken ct)
    {
        var venue = await db.VenueProfiles.AsNoTracking().FirstAsync(v => v.Id == demo.VenueId(look.Slug), ct);
        var hostId = demo.HostId(look.Slug);
        var tonight = CityClock.NightDate(demo.Now, venue.CitySlug);
        var nights = PastNights(tonight).ToList();
        var ids = nights.Select(n => PastPartyId(look.Slug, n)).ToList();
        var existing = (await db.Parties.Where(p => ids.Contains(p.Id)).Select(p => p.Id).ToListAsync(ct)).ToHashSet();
        var bookers = demo.Guests.Skip(NamedGuests).ToList();

        foreach (var night in nights)
        {
            var id = PastPartyId(look.Slug, night);
            if (existing.Contains(id)) continue;
            var start = night.ToDateTime(new TimeOnly(22, 0), DateTimeKind.Utc);
            if (start.AddHours(5) >= demo.Now) continue;

            var party = new Party(id, hostId, venue.Id, new PartyRequest
            {
                Title = night.DayOfWeek == DayOfWeek.Saturday ? look.SaturdayTitle : look.FridayTitle,
                Description = $"{look.Genre} at {venue.VenueName}. Demo party.",
                Price = look.Price, Capacity = look.Capacity, StartsAt = start, EndsAt = start.AddHours(5),
                Latitude = venue.Latitude, Longitude = venue.Longitude, Genre = look.Genre,
            });
            party.PublishNow();
            db.Parties.Add(party);

            // Busier some weeks than others, the same way on every run.
            var spread = (int)((uint)id.GetHashCode() % 36);
            var inside = look.NightGuests * (75 + spread) / 100;
            var passes = Math.Min(look.Capacity, inside * 11 / 10);
            int passesLeft = passes, insideLeft = inside, n = 0;
            while (passesLeft > 0)
            {
                var size = Math.Min(passesLeft, 2 + n % 5);
                var admitted = Math.Min(insideLeft, size);
                var booker = bookers[(n + spread) % bookers.Count].Id;
                var booking = new Booking(booker, id, size, look.Price, $"demo-{id:N}-{n}", party.EndsAt);
                db.Bookings.Add(booking);
                db.Entry(booking).Property(b => b.CreatedAt).CurrentValue = start.AddHours(-20 + n % 18);
                if (admitted > 0)
                {
                    var at = start.AddMinutes(ArrivalMinute((inside - insideLeft + admitted / 2.0) / inside));
                    db.Entry(booking).Property(b => b.CheckedInCount).CurrentValue = admitted;
                    db.Entry(booking).Property(b => b.FirstCheckedInAt).CurrentValue = at;
                    db.Entry(booking).Property(b => b.Status).CurrentValue = BookingStatus.Confirmed;
                    db.CheckIns.Add(new CheckIn { Id = Guid.NewGuid(), BookingId = booking.Id, PartyId = id, Admitted = admitted, At = at, ByUserId = hostId, GuestUserId = booker });
                }
                passesLeft -= size;
                insideLeft -= admitted;
                n++;
            }
            db.Entry(party).Property(p => p.TicketsSold).CurrentValue = passes;
            await db.SaveChangesAsync(ct);
            db.ChangeTracker.Clear();
        }
    }

    /// <summary>
    /// Minutes after the 22:00 UTC start at which the guest at this point of the night's arrivals (0–1) comes in:
    /// a logistic curve around 01:00 UTC, so a few arrive at the start and most around one o'clock.
    /// </summary>
    private static double ArrivalMinute(double share)
    {
        var q = Math.Clamp(share, 0.01, 0.99);
        return Math.Clamp(180 + 45 * Math.Log(q / (1 - q)), 2, 295);
    }
}
