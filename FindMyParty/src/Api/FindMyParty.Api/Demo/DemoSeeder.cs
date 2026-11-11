using System.Security.Cryptography;
using System.Text;
using FindMyParty.Api.Bookings;
using FindMyParty.Api.Data;
using FindMyParty.Api.Identity;
using FindMyParty.Api.Parties;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Demo;

/// <summary>
/// Demo data for looking at the app before real venues exist: seven made-up venues in Podgorica,
/// each with a party that is always on, so the map has light at any hour.
/// Off unless Seed:Demo is true. Demo hosts use @findmyparty.demo addresses and cannot sign in.
/// </summary>
public class DemoSeeder(AppDbContext db, UserManager<ApplicationUser> users, ILogger<DemoSeeder> logger)
{
    public const string EmailDomain = "findmyparty.demo";

    private record Venue(string Slug, string Name, string Address, double Lat, double Lng,
        string Party, string Genre, string Performer, decimal Price, int Capacity, int PassesOut, int Inside, string Later);

    // Inside = guests already scanned in ("live"); 0 with passes out shows as "expected".
    private static readonly Venue[] Venues =
    [
        new("monkey", "Monkey", "Stara Varoš 12", 42.44054, 19.26346, "Neon Friday", "Techno", "DJ Proximus", 5, 300, 268, 214, "House Arrest"),
        new("kula", "Kula", "Njegoševa 21", 42.44123, 19.26495, "Rooftop Session", "House", "Lena K", 8, 220, 190, 160, "Sunset Disco"),
        new("dr-house", "Dr. House", "Bokeška 4", 42.44082, 19.26236, "Deep Cuts", "House", "VRT", 5, 200, 150, 120, "Vinyl Only"),
        new("blok-5", "Blok 5", "Bulevar Džordža Vašingtona 98", 42.43994, 19.2633, "Balkan Bass", "Balkan", "Trio Morača", 3, 150, 110, 90, "Trubači Night"),
        new("neon-basta", "Neon Bašta", "Hercegovačka 30", 42.44206, 19.26419, "Garden Live", "Live", "Ana & Band", 0, 120, 70, 0, "Acoustic Sunday"),
        new("hangar-7", "Hangar 7", "Oktobarske revolucije 7", 42.442, 19.2625, "Warehouse", "Techno", "Kontra", 6, 100, 52, 40, "Raw Cuts"),
        new("atlas", "Atlas", "Cetinjska 11", 42.44006, 19.26507, "Ladies Night", "Pop", "DJ Mila", 0, 80, 18, 12, "Throwback Thursday"),
    ];

    /// <summary>A fixed id per demo venue, so restarts find the same rows.</summary>
    private static Guid IdFor(string slug) => new(MD5.HashData(Encoding.UTF8.GetBytes("findmyparty-demo-venue:" + slug)));

    /// <summary>Creates what is missing and keeps one running party per demo venue. Safe to call again and again.</summary>
    public async Task EnsureAsync(string? ownerEmail = null, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        foreach (var v in Venues)
        {
            var venueId = IdFor(v.Slug);
            var hostUserId = await db.VenueProfiles.Where(p => p.Id == venueId).Select(p => p.UserId).FirstOrDefaultAsync(ct)
                             ?? await CreateVenueAsync(v, venueId, ct);
            var hostId = Guid.Parse(hostUserId);
            await MoveIfNeededAsync(v, venueId, ct);

            var open = db.Parties.Where(p => p.VenueId == venueId && p.Status == PartyStatus.Published && !p.IsDeleted);
            if (!await open.AnyAsync(p => p.StartsAt <= now && p.EndsAt > now.AddHours(1), ct))
                await AddRunningPartyAsync(v, venueId, hostId, now, ct);
            if (!await open.AnyAsync(p => p.StartsAt > now, ct))
                await AddUpcomingPartiesAsync(v, venueId, hostId, now, ct);
        }

        if (!string.IsNullOrWhiteSpace(ownerEmail))
            await MakeOwnerAsync(ownerEmail, ct);
    }

    /// <summary>A demo venue whose place in this file has changed moves there, with its parties.</summary>
    private async Task MoveIfNeededAsync(Venue v, Guid venueId, CancellationToken ct)
    {
        var moved = await db.VenueProfiles
            .Where(p => p.Id == venueId && (p.Latitude != v.Lat || p.Longitude != v.Lng))
            .ExecuteUpdateAsync(set => set.SetProperty(p => p.Latitude, v.Lat).SetProperty(p => p.Longitude, v.Lng), ct);
        if (moved == 0) return;
        await db.Parties
            .Where(p => p.VenueId == venueId)
            .ExecuteUpdateAsync(set => set.SetProperty(p => p.Latitude, v.Lat).SetProperty(p => p.Longitude, v.Lng), ct);
        logger.LogInformation("Demo venue moved: {Venue}", v.Name);
    }

    private async Task<string> CreateVenueAsync(Venue v, Guid venueId, CancellationToken ct)
    {
        var email = $"demo-{v.Slug}@{EmailDomain}";
        var host = await users.FindByEmailAsync(email);
        if (host is null)
        {
            host = new ApplicationUser { UserName = "demo_" + v.Slug.Replace('-', '_'), Email = email, EmailConfirmed = true };
            var created = await users.CreateAsync(host); // no password: nobody can sign in as a demo host
            if (!created.Succeeded) throw new InvalidOperationException("Demo host: " + string.Join("; ", created.Errors.Select(e => e.Description)));
            await users.AddToRolesAsync(host, [Roles.User, Roles.Host]);
        }

        db.VenueProfiles.Add(new VenueProfile
        {
            Id = venueId,
            UserId = host.Id,
            VenueName = v.Name,
            Address = v.Address,
            Latitude = v.Lat,
            Longitude = v.Lng,
            WorkingHoursOpen = new TimeOnly(22, 0),
            WorkingHoursClose = new TimeOnly(4, 0),
            WorkingDays = "Thu,Fri,Sat"
        });
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Demo venue created: {Venue}", v.Name);
        return host.Id;
    }

    private static PartyRequest Request(Venue v, string title, DateTime startsAt, DateTime endsAt) => new()
    {
        Title = title,
        Description = $"{v.Genre} at {v.Name}. Demo party.",
        Price = v.Price,
        Capacity = v.Capacity,
        StartsAt = startsAt,
        EndsAt = endsAt,
        Latitude = v.Lat,
        Longitude = v.Lng,
        Genre = v.Genre,
        PerformerName = v.Performer,
        PerformerType = v.Genre == "Live" || v.Genre == "Balkan" ? "Band" : "DJ",
    };

    /// <summary>A party that started 90 minutes ago, with bookings and door scans that add up to the venue's numbers.</summary>
    private async Task AddRunningPartyAsync(Venue v, Guid venueId, Guid hostId, DateTime now, CancellationToken ct)
    {
        var party = new Party(hostId, venueId, Request(v, v.Party, now.AddMinutes(-90), now.AddHours(12)));
        party.PublishNow();
        db.Parties.Add(party);
        db.Entry(party).Property(p => p.TicketsSold).CurrentValue = v.PassesOut;

        // Bookings of up to six guests by made-up people. The first ones are already inside.
        int passesLeft = v.PassesOut, insideLeft = v.Inside, n = 0;
        while (passesLeft > 0)
        {
            var size = Math.Min(passesLeft, 2 + n % 5);
            var inside = Math.Min(insideLeft, size);
            var booking = new Booking(Guid.NewGuid(), party.Id, size, v.Price, $"demo-{n}", party.EndsAt);
            db.Bookings.Add(booking);
            if (inside > 0)
            {
                // Arrivals spread over the last 90 minutes, busier towards now.
                var at = now.AddMinutes(-90 * Math.Pow(1 - (double)(v.Inside - insideLeft) / Math.Max(v.Inside, 1), 1.6));
                db.Entry(booking).Property(b => b.CheckedInCount).CurrentValue = inside;
                db.Entry(booking).Property(b => b.FirstCheckedInAt).CurrentValue = at;
                db.Entry(booking).Property(b => b.Status).CurrentValue = BookingStatus.Confirmed;
                db.CheckIns.Add(new CheckIn { Id = Guid.NewGuid(), BookingId = booking.Id, PartyId = party.Id, Admitted = inside, At = at, ByUserId = hostId });
            }
            passesLeft -= size;
            insideLeft -= inside;
            n++;
        }
        await db.SaveChangesAsync(ct);
    }

    private async Task AddUpcomingPartiesAsync(Venue v, Guid venueId, Guid hostId, DateTime now, CancellationToken ct)
    {
        // The next Friday and Saturday night, 22:00–03:00 UTC (23:00–04:00 in Podgorica in winter).
        var friday = now.Date.AddDays(((int)DayOfWeek.Friday - (int)now.DayOfWeek + 7) % 7).AddHours(22);
        if (friday <= now.AddHours(13)) friday = friday.AddDays(7); // do not overlap the running party
        foreach (var (title, start) in new[] { (v.Party, friday), (v.Later, friday.AddDays(1)) })
        {
            var party = new Party(hostId, venueId, Request(v, title, start, start.AddHours(5)));
            party.Publish();
            db.Parties.Add(party);
        }
        await db.SaveChangesAsync(ct);
    }

    /// <summary>The owner becomes Admin and Host, and takes over the first demo venue so they can try the host side.</summary>
    private async Task MakeOwnerAsync(string email, CancellationToken ct)
    {
        var owner = await users.FindByEmailAsync(email);
        if (owner is null)
        {
            logger.LogWarning("Seed:OwnerEmail is set but no account with that email exists yet. Register in the app, then restart.");
            return;
        }

        foreach (var role in new[] { Roles.Admin, Roles.Host })
            if (!await users.IsInRoleAsync(owner, role))
                await users.AddToRoleAsync(owner, role);

        if (await db.VenueProfiles.AnyAsync(p => p.UserId == owner.Id, ct)) return;

        var venueId = IdFor(Venues[0].Slug);
        var ownerId = Guid.Parse(owner.Id);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.VenueProfiles.Where(p => p.Id == venueId).ExecuteUpdateAsync(s => s.SetProperty(p => p.UserId, owner.Id), ct);
        await db.Parties.Where(p => p.VenueId == venueId).ExecuteUpdateAsync(s => s.SetProperty(p => p.HostId, ownerId), ct);
        await tx.CommitAsync(ct);
        logger.LogWarning("Demo venue {Venue} now belongs to {UserId} (Seed:OwnerEmail)", Venues[0].Name, owner.Id);
    }
}

/// <summary>Keeps the demo city lit: every half hour, makes sure each demo venue still has a running party.</summary>
public class DemoRefresher(IServiceScopeFactory scopes, IConfiguration config, ILogger<DemoRefresher> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(30));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = scopes.CreateScope();
                await scope.ServiceProvider.GetRequiredService<DemoSeeder>().EnsureAsync(config["Seed:OwnerEmail"], stoppingToken);
            }
            catch (Exception e) when (e is not OperationCanceledException)
            {
                logger.LogError(e, "Refreshing demo data failed; will try again in 30 minutes");
            }
        }
    }
}
