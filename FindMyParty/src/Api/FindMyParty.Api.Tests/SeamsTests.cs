using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using FindMyParty.Api.Bookings;
using FindMyParty.Api.Cities;
using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using FindMyParty.Api.Demo;
using FindMyParty.Api.Identity;
using FindMyParty.Api.Parties;
using FindMyParty.Api.Venues;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace FindMyParty.Api.Tests;

/// <summary>The seams: the places where a feature plugs into the API without editing a shared file.</summary>
[Collection("api")]
public class SeamsTests(TestApp app)
{
    private static HttpClient As(WebApplicationFactory<Program> host, Actor actor)
    {
        var client = host.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", actor.Tokens.AccessToken);
        return client;
    }

    /// <summary>A host whose venue and one published party sit alone at a spot of their own, so list calls find them.</summary>
    private async Task<(Actor Host, Guid Venue, Guid Party, string Near)> AloneAsync()
    {
        var (lat, lng) = TestApp.NewSpot();
        var host = await app.HostAsync();
        var hostId = host.Id.ToString();
        var venue = await app.WithDb(async db =>
        {
            var v = await db.VenueProfiles.SingleAsync(x => x.UserId == hostId);
            v.Latitude = lat;
            v.Longitude = lng;
            await db.SaveChangesAsync();
            return v.Id;
        });
        var created = await host.Http.PostAsJsonAsync("/api/parties", new
        {
            title = "Seam night", description = "A party.", price = 5, capacity = 50,
            startsAt = DateTime.UtcNow.AddHours(4), endsAt = DateTime.UtcNow.AddHours(9), latitude = lat, longitude = lng, genre = "Techno",
        });
        created.EnsureSuccessStatusCode();
        var party = (await created.Content.ReadFromJsonAsync<TestApp.IdBody>())!.Id;
        (await host.Http.PostAsync($"/api/parties/{party}/publish", null)).EnsureSuccessStatusCode();
        var near = string.Create(CultureInfo.InvariantCulture, $"lat={lat}&lng={lng}&radiusKm=1&pageSize=100");
        return (host, venue, party, near);
    }

    // ── enrichers and Extra ──

    /// <summary>Writes the way a feature would: a camelCase key, a value that is an ordinary C# object.</summary>
    private class Stamp : IPartyEnricher, IPartyDetailEnricher, IVenueEnricher, IVenueDetailEnricher
    {
        private record FriendsHere(int Count, string[] Names, string[] Initials);

        private static void Write(Dictionary<string, object?> extra, Guid? viewerId)
        {
            extra["friendsHere"] = new FriendsHere(2, ["Mila", "Luka"], ["M", "L"]);
            extra["sponsored"] = true;
            extra["viewer"] = viewerId;
        }

        public Task EnrichAsync(IReadOnlyList<PartyResponse> parties, Guid? viewerId, CancellationToken ct)
        {
            foreach (var p in parties) Write(p.Extra, viewerId);
            return Task.CompletedTask;
        }

        public Task EnrichAsync(PartyDetailResponse party, Guid? viewerId, CancellationToken ct)
        {
            Write(party.Extra, viewerId);
            return Task.CompletedTask;
        }

        public Task EnrichAsync(IReadOnlyList<VenueSummary> venues, Guid? viewerId, CancellationToken ct)
        {
            foreach (var v in venues) Write(v.Extra, viewerId);
            return Task.CompletedTask;
        }

        public Task EnrichAsync(VenueResponse venue, Guid? viewerId, CancellationToken ct)
        {
            Write(venue.Extra, viewerId);
            return Task.CompletedTask;
        }
    }

    private WebApplicationFactory<Program> Stamped() => app.WithServices(s =>
    {
        s.AddScoped<IPartyEnricher, Stamp>();
        s.AddScoped<IPartyDetailEnricher, Stamp>();
        s.AddScoped<IVenueEnricher, Stamp>();
        s.AddScoped<IVenueDetailEnricher, Stamp>();
    });

    private static void AssertStamped(JsonElement json, Guid? viewer, string ownProperty)
    {
        // The enricher's keys sit beside the response's own properties, not under "extra".
        Assert.True(json.TryGetProperty(ownProperty, out _));
        Assert.False(json.TryGetProperty("extra", out _));
        Assert.False(json.TryGetProperty("Extra", out _));

        // The value object is written with the API's own JSON settings: camelCase all the way down.
        var friends = json.GetProperty("friendsHere");
        Assert.Equal(2, friends.GetProperty("count").GetInt32());
        Assert.Equal(["Mila", "Luka"], friends.GetProperty("names").EnumerateArray().Select(n => n.GetString()));
        Assert.Equal(["M", "L"], friends.GetProperty("initials").EnumerateArray().Select(n => n.GetString()));
        Assert.False(friends.TryGetProperty("Count", out _));
        Assert.True(json.GetProperty("sponsored").GetBoolean());

        if (viewer is null) Assert.Equal(JsonValueKind.Null, json.GetProperty("viewer").ValueKind);
        else Assert.Equal(viewer, json.GetProperty("viewer").GetGuid());
    }

    [Fact]
    public async Task A_key_an_enricher_writes_shows_up_as_a_JSON_property_on_all_four_responses()
    {
        var (_, venue, party, near) = await AloneAsync();
        var guest = await app.UserAsync();
        using var stamped = Stamped();
        var http = As(stamped, guest);

        var feed = await http.GetFromJsonAsync<JsonElement>($"/api/parties?{near}");
        var detail = await http.GetFromJsonAsync<JsonElement>($"/api/parties/{party}");
        var venues = await http.GetFromJsonAsync<JsonElement>($"/api/venues?{near}");
        var venuePage = await http.GetFromJsonAsync<JsonElement>($"/api/venues/{venue}");

        AssertStamped(Assert.Single(feed.EnumerateArray()), guest.Id, "title");
        AssertStamped(detail, guest.Id, "remainingCapacity");
        AssertStamped(Assert.Single(venues.EnumerateArray()), guest.Id, "partyTitle");
        AssertStamped(venuePage, guest.Id, "parties");
    }

    [Fact]
    public async Task Enrichers_run_for_signed_out_callers_too_and_are_told_there_is_no_viewer()
    {
        var (_, venue, party, near) = await AloneAsync();
        using var stamped = Stamped();
        var http = stamped.CreateClient();

        AssertStamped(Assert.Single((await http.GetFromJsonAsync<JsonElement>($"/api/parties?{near}")).EnumerateArray()), null, "title");
        AssertStamped(await http.GetFromJsonAsync<JsonElement>($"/api/parties/{party}"), null, "title");
        AssertStamped(Assert.Single((await http.GetFromJsonAsync<JsonElement>($"/api/venues?{near}")).EnumerateArray()), null, "name");
        AssertStamped(await http.GetFromJsonAsync<JsonElement>($"/api/venues/{venue}"), null, "name");
    }

    [Fact]
    public async Task A_token_that_is_not_valid_is_no_viewer_rather_than_an_error()
    {
        var (_, _, party, _) = await AloneAsync();
        using var stamped = Stamped();
        var http = stamped.CreateClient();
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "not-a-token");

        var response = await http.GetAsync($"/api/parties/{party}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        AssertStamped(await response.Content.ReadFromJsonAsync<JsonElement>(), null, "title");
    }

    [Fact]
    public async Task With_no_enrichers_the_responses_carry_nothing_extra()
    {
        var (_, venue, party, near) = await AloneAsync();
        var http = app.CreateClient();

        var feedRow = Assert.Single((await http.GetFromJsonAsync<JsonElement>($"/api/parties?{near}")).EnumerateArray());
        var detail = await http.GetFromJsonAsync<JsonElement>($"/api/parties/{party}");
        var venueRow = Assert.Single((await http.GetFromJsonAsync<JsonElement>($"/api/venues?{near}")).EnumerateArray());
        var venuePage = await http.GetFromJsonAsync<JsonElement>($"/api/venues/{venue}");

        Assert.All(new[] { feedRow, detail, venueRow, venuePage }, json =>
        {
            Assert.False(json.TryGetProperty("extra", out _));
            Assert.False(json.TryGetProperty("friendsHere", out _));
        });
    }

    [Fact]
    public async Task What_an_enricher_added_survives_reading_the_response_back_into_the_same_class()
    {
        var (_, _, party, near) = await AloneAsync();
        using var stamped = Stamped();

        var feed = await stamped.CreateClient().GetFromJsonAsync<List<PartyResponse>>($"/api/parties?{near}");
        var venues = await stamped.CreateClient().GetFromJsonAsync<List<VenueSummary>>($"/api/venues?{near}");

        var row = Assert.Single(feed!);
        Assert.Equal(party, row.Id);
        Assert.Equal(2, ((JsonElement)row.Extra["friendsHere"]!).GetProperty("count").GetInt32());
        Assert.Equal(party, Assert.Single(venues!).PartyId);
        Assert.True(((JsonElement)venues![0].Extra["sponsored"]!).GetBoolean());
    }

    // ── check-in listeners ──

    private class Recorder : ICheckInListener
    {
        public List<CheckInEvent> Events { get; } = [];

        public Task OnCheckedInAsync(CheckInEvent e, CancellationToken ct)
        {
            lock (Events) Events.Add(e);
            return Task.CompletedTask;
        }
    }

    private class Broken : ICheckInListener
    {
        public int Calls;

        public Task OnCheckedInAsync(CheckInEvent e, CancellationToken ct)
        {
            Interlocked.Increment(ref Calls);
            throw new InvalidOperationException("a listener that fails");
        }
    }

    private record PassBody(Guid BookingId, string Secret);
    private record ScanBody(int Admitted, int CheckedInCount);

    private static async Task<string> CodeAsync(Actor guest, Guid booking, int stepsAgo = 0)
    {
        var pass = (await guest.Http.GetFromJsonAsync<PassBody>($"/api/bookings/{booking}/pass"))!;
        return PassCode.Format(pass.BookingId, PassCode.Compute(pass.Secret, PassCode.StepAt(DateTime.UtcNow) - stepsAgo));
    }

    [Fact]
    public async Task A_listener_hears_each_scan_once_after_it_is_saved_and_one_that_throws_does_not_fail_the_scan()
    {
        var recorder = new Recorder();
        var broken = new Broken();
        using var listening = app.WithServices(s =>
        {
            s.AddSingleton<ICheckInListener>(broken); // first, so the one after it must still be told
            s.AddSingleton<ICheckInListener>(recorder);
        });
        var (host, venue, party, _) = await AloneAsync();
        var guest = await app.UserAsync();
        var booking = await guest.BookedAsync(party, tickets: 3);
        var door = As(listening, host);
        var before = DateTime.UtcNow.AddSeconds(-1);

        var first = await door.PostAsJsonAsync("/api/checkins", new { code = await CodeAsync(guest, booking), admit = 1 });
        var rest = await door.PostAsJsonAsync("/api/checkins", new { code = await CodeAsync(guest, booking) });

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, rest.StatusCode);
        Assert.Equal(3, (await rest.Content.ReadFromJsonAsync<ScanBody>())!.CheckedInCount);
        Assert.Equal(2, broken.Calls);

        Assert.Equal(2, recorder.Events.Count);
        var (one, two) = (recorder.Events[0], recorder.Events[1]);
        Assert.Equal((booking, party, (Guid?)venue, guest.Id, 1, true), (one.BookingId, one.PartyId, one.VenueId, one.GuestUserId, one.Admitted, one.FirstForGuest));
        Assert.Equal((booking, party, (Guid?)venue, guest.Id, 2, false), (two.BookingId, two.PartyId, two.VenueId, two.GuestUserId, two.Admitted, two.FirstForGuest));
        Assert.InRange(one.At, before, DateTime.UtcNow.AddSeconds(1));

        // The event names the row that was saved, and the row says who came in.
        var rows = await app.WithDb(db => db.CheckIns.Where(c => c.BookingId == booking).OrderBy(c => c.At).ToListAsync());
        Assert.Equal([one.CheckInId, two.CheckInId], rows.Select(r => r.Id));
        Assert.All(rows, r => Assert.Equal(guest.Id, r.GuestUserId));
    }

    [Fact]
    public async Task A_scan_that_is_refused_tells_no_listener()
    {
        var recorder = new Recorder();
        using var listening = app.WithServices(s => s.AddSingleton<ICheckInListener>(recorder));
        var (host, _, party, _) = await AloneAsync();
        var guest = await app.UserAsync();
        var booking = await guest.BookedAsync(party, tickets: 1);
        var door = As(listening, host);

        var screenshot = await door.PostAsJsonAsync("/api/checkins", new { code = await CodeAsync(guest, booking, stepsAgo: 6) });
        var looking = await door.PostAsJsonAsync("/api/checkins/preview", new { code = await CodeAsync(guest, booking) });
        Assert.Equal(HttpStatusCode.Conflict, screenshot.StatusCode);
        Assert.Equal(HttpStatusCode.OK, looking.StatusCode);
        Assert.Empty(recorder.Events);

        (await door.PostAsJsonAsync("/api/checkins", new { code = await CodeAsync(guest, booking) })).EnsureSuccessStatusCode();
        var again = await door.PostAsJsonAsync("/api/checkins", new { code = await CodeAsync(guest, booking) });

        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
        Assert.Single(recorder.Events);
    }

    [Fact]
    public async Task Eight_doors_scanning_one_pass_at_once_tell_the_listener_once()
    {
        var recorder = new Recorder();
        using var listening = app.WithServices(s => s.AddSingleton<ICheckInListener>(recorder));
        var (host, _, party, _) = await AloneAsync();
        var guest = await app.UserAsync();
        var booking = await guest.BookedAsync(party, tickets: 2);
        var door = As(listening, host);
        var code = await CodeAsync(guest, booking);

        await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => door.PostAsJsonAsync("/api/checkins", new { code })));

        var heard = Assert.Single(recorder.Events);
        Assert.True(heard.FirstForGuest);
        Assert.Equal(2, heard.Admitted);
    }

    // ── account cleanup ──

    private class CleanupProbe(AppDbContext db, List<(Guid UserId, bool InTransaction, bool UserStillThere)> log, bool fail) : IAccountCleanup
    {
        public async Task DeleteAsync(Guid userId, CancellationToken ct)
        {
            var id = userId.ToString();
            log.Add((userId, db.Database.CurrentTransaction is not null, await db.Users.AnyAsync(u => u.Id == id, ct)));
            if (fail) throw new InvalidOperationException("a cleanup that fails");
        }
    }

    [Fact]
    public async Task Deleting_an_account_runs_every_cleanup_inside_the_delete_transaction()
    {
        var log = new List<(Guid UserId, bool InTransaction, bool UserStillThere)>();
        using var cleaning = app.WithServices(s =>
        {
            s.AddScoped<IAccountCleanup>(sp => new CleanupProbe(sp.GetRequiredService<AppDbContext>(), log, fail: false));
            s.AddScoped<IAccountCleanup>(sp => new CleanupProbe(sp.GetRequiredService<AppDbContext>(), log, fail: false));
        });
        var user = await app.UserAsync();

        var response = await As(cleaning, user).DeleteAsync("/api/auth/account");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal([(user.Id, true, true), (user.Id, true, true)], log);
        Assert.False(await app.WithDb(db => db.Users.AnyAsync(u => u.Id == user.Id.ToString())));
    }

    [Fact]
    public async Task A_cleanup_that_fails_leaves_the_account_and_its_bookings_as_they_were()
    {
        var log = new List<(Guid UserId, bool InTransaction, bool UserStillThere)>();
        using var cleaning = app.WithServices(s =>
            s.AddScoped<IAccountCleanup>(sp => new CleanupProbe(sp.GetRequiredService<AppDbContext>(), log, fail: true)));
        var (_, _, party, _) = await AloneAsync();
        var user = await app.UserAsync();
        var booking = await user.BookedAsync(party, tickets: 2);

        var response = await As(cleaning, user).DeleteAsync("/api/auth/account");

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.Single(log);
        Assert.True(await app.WithDb(db => db.Users.AnyAsync(u => u.Id == user.Id.ToString())));
        Assert.True(await app.WithDb(db => db.Bookings.AnyAsync(b => b.Id == booking)));
        Assert.Equal(2, await app.TicketsSoldAsync(party));
    }

    // ── demo seeds ──

    private class ProbeSeed(int order, List<int> ran, List<DemoContext> seen) : IDemoSeed
    {
        public int Order => order;

        public Task SeedAsync(DemoContext demo, CancellationToken ct)
        {
            ran.Add(order);
            seen.Add(demo);
            return Task.CompletedTask;
        }
    }

    private static string NewDatabase() => "seams_" + Guid.NewGuid().ToString("N")[..10];

    private WebApplicationFactory<Program> Seeded(string database, List<int> ran, List<DemoContext> seen, string? ownerEmail = null) => app.WithServices(
        s =>
        {
            // Registered out of order on purpose.
            s.AddScoped<IDemoSeed>(_ => new ProbeSeed(20, ran, seen));
            s.AddScoped<IDemoSeed>(_ => new ProbeSeed(10, ran, seen));
        },
        new()
        {
            ["ConnectionStrings:DefaultConnection"] = app.ConnectionStringFor(database),
            ["Seed:Demo"] = "true",
            ["Seed:OwnerEmail"] = ownerEmail,
        });

    private record SeedCounts(int Users, int Venues, int Parties, int Bookings, int CheckIns);

    private static async Task<SeedCounts> CountAsync(AppDbContext db) => new(
        await db.Users.CountAsync(), await db.VenueProfiles.CountAsync(), await db.Parties.CountAsync(),
        await db.Bookings.CountAsync(), await db.CheckIns.CountAsync());

    [Fact]
    public async Task Demo_seeds_run_after_the_base_seed_in_order_and_a_second_run_duplicates_nothing()
    {
        var (ran, seen) = (new List<int>(), new List<DemoContext>());
        using var seeded = Seeded(NewDatabase(), ran, seen);
        seeded.CreateClient(); // starts the service, which seeds

        Assert.Equal([10, 20], ran);
        using var scope = seeded.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var afterFirst = await CountAsync(db);

        await scope.ServiceProvider.GetRequiredService<DemoSeeder>().EnsureAsync();

        Assert.Equal([10, 20, 10, 20], ran);
        Assert.Equal(afterFirst, await CountAsync(db));
        Assert.Equal(7 + 24 + 2, afterFirst.Users); // seven demo hosts, twenty-four demo guests, Monkey's two door logins
        Assert.Equal(7, afterFirst.Venues);
    }

    [Fact]
    public async Task A_demo_seed_is_handed_the_venues_parties_and_guests_the_base_seed_made()
    {
        var (ran, seen) = (new List<int>(), new List<DemoContext>());
        using var seeded = Seeded(NewDatabase(), ran, seen);
        seeded.CreateClient();
        var demo = seen[0];
        using var scope = seeded.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var monkey = await db.VenueProfiles.SingleAsync(v => v.Id == demo.VenueId("monkey"));
        var running = await db.Parties.SingleAsync(p => p.Id == demo.RunningPartyId("monkey"));
        var upcoming = await db.Parties.Where(p => demo.UpcomingPartyIds("monkey").Contains(p.Id)).ToListAsync();
        var mila = await db.Users.SingleAsync(u => u.Id == demo.Guest("mila").ToString());

        Assert.Equal(["monkey", "kula", "dr-house", "blok-5", "neon-basta", "hangar-7", "atlas"], demo.VenueSlugs);
        Assert.Equal("Monkey", monkey.VenueName);
        Assert.Equal(monkey.UserId, demo.HostId("monkey").ToString());
        Assert.Equal((monkey.Id, true), (running.VenueId!.Value, running.StartsAt <= demo.Now && running.EndsAt > demo.Now));
        Assert.Equal(2, upcoming.Count);
        Assert.All(upcoming, p => Assert.True(p.StartsAt > demo.Now && p.VenueId == monkey.Id));
        Assert.InRange(demo.Now, DateTime.UtcNow.AddMinutes(-1), DateTime.UtcNow);

        Assert.Equal(24, demo.Guests.Count);
        Assert.Equal(["mila", "luka", "ana", "dino", "sara", "jovana"], demo.Guests.Take(6).Select(g => g.Handle));
        Assert.Equal(["Mila Perić", "Luka Vuković", "Ana Radović", "Dino Hadžić", "Sara Kovač", "Jovana Ilić"], demo.Guests.Take(6).Select(g => g.DisplayName));
        Assert.Equal(("mila", "Mila Perić", "demo-guest-01@findmyparty.demo", (string?)null), (mila.UserName, mila.DisplayName, mila.Email, mila.PasswordHash));
        Assert.Equal(24, demo.Guests.Select(g => g.Id).Distinct().Count());

        Assert.Null(demo.OwnerId);
        Assert.Equal(demo.IdFor("perk:volt"), demo.IdFor("perk:volt"));
        Assert.Equal(demo.IdFor("perk:volt"), DemoContext.Id("perk:volt"));
        Assert.NotEqual(demo.IdFor("perk:volt"), demo.IdFor("perk:aura"));
        Assert.Throws<ArgumentException>(() => demo.VenueId("no-such-venue"));
        Assert.Throws<ArgumentException>(() => demo.Guest("nobody"));
    }

    [Fact]
    public async Task A_demo_seed_is_told_who_the_owner_is_once_that_account_exists()
    {
        var database = NewDatabase();
        var email = $"owner-{Guid.NewGuid():N}@example.test";
        var (ran, seen) = (new List<int>(), new List<DemoContext>());
        using (var first = Seeded(database, ran, seen, ownerEmail: email))
        {
            var register = await first.CreateClient().PostAsJsonAsync("/api/auth/register",
                new { userName = "owner" + Guid.NewGuid().ToString("N")[..8], email, password = Actor.DefaultPassword });
            register.EnsureSuccessStatusCode();
            Assert.Null(seen[^1].OwnerId);
        }

        using var second = Seeded(database, ran, seen, ownerEmail: email);
        second.CreateClient();

        var demo = seen[^1];
        using var scope = second.Services.CreateScope();
        var owner = await scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>().FindByEmailAsync(email);
        Assert.Equal(Guid.Parse(owner!.Id), demo.OwnerId);
        Assert.Equal(demo.OwnerId, demo.HostId("monkey")); // the owner took the first venue over
        Assert.NotEqual(demo.OwnerId, demo.HostId("kula"));
    }

    [Fact]
    public async Task Demo_bookings_belong_to_demo_guests_and_every_scan_says_who_came_in()
    {
        var (ran, seen) = (new List<int>(), new List<DemoContext>());
        using var seeded = Seeded(NewDatabase(), ran, seen);
        seeded.CreateClient();
        var demo = seen[0];
        using var scope = seeded.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var guestIds = demo.Guests.Select(g => g.Id).ToHashSet();
        var bookings = await db.Bookings.ToListAsync();
        var scans = await db.CheckIns.ToListAsync();

        Assert.NotEmpty(bookings);
        Assert.All(bookings, b => Assert.Contains(b.UserId, guestIds));
        Assert.NotEmpty(scans);
        var bookers = bookings.ToDictionary(b => b.Id, b => b.UserId);
        Assert.All(scans, s => Assert.Equal(bookers[s.BookingId], s.GuestUserId));

        // The six named guests are the owner's friends-to-be. The base seed puts them nowhere,
        // so the friends seed alone decides which venue each of them is seen at.
        var named = demo.Guests.Take(6).Select(g => g.Id).ToHashSet();
        Assert.DoesNotContain(bookings, b => named.Contains(b.UserId));
        Assert.Equal(18, bookings.Select(b => b.UserId).Distinct().Count());

        // The public numbers still add up as before.
        var venues = await seeded.CreateClient().GetFromJsonAsync<List<VenueSummary>>("/api/venues?pageSize=100");
        Assert.Contains(venues!, v => v is { Name: "Monkey", CrowdLevel: "200+", CrowdSource: "live" });
    }

    // ── city time ──

    [Theory]
    // Winter: Podgorica is UTC+1.
    [InlineData("2026-11-14T04:59:00Z", "2026-11-13")] // 05:59 on Saturday morning is still Friday's night
    [InlineData("2026-11-14T05:00:00Z", "2026-11-14")] // 06:00: Saturday has begun
    [InlineData("2026-11-13T22:30:00Z", "2026-11-13")] // 23:30 on Friday
    [InlineData("2026-11-13T23:30:00Z", "2026-11-13")] // 00:30 on Saturday
    // Summer: UTC+2.
    [InlineData("2026-07-04T03:59:00Z", "2026-07-03")]
    [InlineData("2026-07-04T04:00:00Z", "2026-07-04")]
    public void A_night_belongs_to_the_day_it_started_on_until_six_in_the_morning(string utc, string night)
    {
        var moment = DateTime.Parse(utc, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal);

        Assert.Equal(DateOnly.Parse(night, CultureInfo.InvariantCulture), CityClock.NightDate(moment, "podgorica"));
        Assert.Equal(DateOnly.Parse(night, CultureInfo.InvariantCulture), CityClock.NightDate(moment, "budva"));
        Assert.Equal(DateOnly.Parse(night, CultureInfo.InvariantCulture), CityClock.NightDate(moment, null)); // no city: Podgorica's time
    }

    [Fact]
    public void City_time_is_the_wall_clock_in_that_city_and_goes_back_to_UTC()
    {
        var winter = new DateTime(2026, 11, 13, 22, 30, 0, DateTimeKind.Utc);
        var summer = new DateTime(2026, 7, 3, 22, 30, 0, DateTimeKind.Utc);

        Assert.Equal(new DateTime(2026, 11, 13, 23, 30, 0), CityClock.Local(winter, "podgorica"));
        Assert.Equal(new DateTime(2026, 7, 4, 0, 30, 0), CityClock.Local(summer, "kotor"));
        Assert.Equal(winter, CityClock.Utc(new DateTime(2026, 11, 13, 23, 30, 0), "podgorica"));
        Assert.Equal(DateTimeKind.Utc, CityClock.Utc(new DateTime(2026, 11, 13, 23, 30, 0), "podgorica").Kind);
        // 02:30 on the night clocks go forward does not exist; it is taken as 03:30.
        Assert.Equal(new DateTime(2026, 3, 29, 1, 30, 0, DateTimeKind.Utc), CityClock.Utc(new DateTime(2026, 3, 29, 2, 30, 0), "podgorica"));
        Assert.Equal("Europe/Podgorica", CityClock.DefaultTimeZone);
        Assert.Equal(CityClock.Zone("podgorica"), CityClock.Zone("somewhere-else"));
    }

    [Fact]
    public void Friday_Saturday_and_Sunday_nights_are_the_weekend()
    {
        var monday = new DateOnly(2026, 11, 9);

        Assert.Equal([false, false, false, false, true, true, true],
            Enumerable.Range(0, 7).Select(day => CityClock.IsWeekendNight(monday.AddDays(day))));
    }

    [Fact]
    public async Task The_six_cities_exist_each_with_a_time_zone_the_server_knows()
    {
        var cities = await app.WithDb(db => db.Set<City>().OrderBy(c => c.Order).ToListAsync());

        Assert.Equal(["podgorica", "budva", "niksic", "kotor", "tivat", "herceg-novi"], cities.Select(c => c.Slug));
        Assert.Equal(["Podgorica", "Budva", "Nikšić", "Kotor", "Tivat", "Herceg Novi"], cities.Select(c => c.Name));
        Assert.Equal((42.4419, 19.2632), (cities[0].Latitude, cities[0].Longitude));
        Assert.Equal((42.4531, 18.5375), (cities[5].Latitude, cities[5].Longitude));
        Assert.All(cities, c => Assert.Equal(12, c.RadiusKm));
        Assert.All(cities, c => Assert.Equal(TimeSpan.FromHours(1), TimeZoneInfo.FindSystemTimeZoneById(c.TimeZone).BaseUtcOffset));
    }

    // ── what the test app swaps in, and the defaults behind them ──

    [Fact]
    public async Task In_tests_pushes_and_mails_go_to_the_fakes_which_record_them()
    {
        using var scope = app.Services.CreateScope();
        var notifier = scope.ServiceProvider.GetRequiredService<INotifier>();
        var mail = scope.ServiceProvider.GetRequiredService<IEmailSender>();
        var (someone, address) = (Guid.NewGuid(), $"{Guid.NewGuid():N}@example.test");

        await notifier.SendAsync(new Push([someone], "scanned", "You're in.", "+150 Glow at Monkey", new { bookingId = Guid.Empty }));
        await mail.SendAsync(address, "Reset your FindMyParty password", "<p>link</p>", "link");

        Assert.Same(app.Notifier, notifier);
        Assert.Same(app.Email, mail);
        var push = Assert.Single(app.Notifier.SentTo(someone));
        Assert.Equal(("scanned", "You're in.", NotifyCategory.Transactional), (push.Type, push.Title, push.Category));
        Assert.Single(app.Notifier.SentTo(someone, "scanned"));
        Assert.Empty(app.Notifier.SentTo(someone, "referral"));
        Assert.Equal("link", Assert.Single(app.Email.SentTo(address)).Text);
    }

    [Fact]
    public void Outside_tests_push_goes_through_Expo_doors_take_door_logins_and_mail_is_only_logged_until_a_key_is_set()
    {
        var config = new ConfigurationBuilder().Build();

        var plain = new ServiceCollection().AddFeatures(config);
        var withOwn = new ServiceCollection().AddSingleton<INotifier>(new FakeNotifier()).AddFeatures(config);

        Assert.Equal(typeof(FindMyParty.Api.Messaging.ExpoNotifier), Assert.Single(plain, d => d.ServiceType == typeof(INotifier)).ImplementationType);
        Assert.Equal(typeof(LogEmailSender), Assert.Single(plain, d => d.ServiceType == typeof(IEmailSender)).ImplementationType);
        Assert.Equal(typeof(FindMyParty.Api.Door.DoorVenueAccess), Assert.Single(plain, d => d.ServiceType == typeof(IVenueAccess)).ImplementationType);
        Assert.IsType<FakeNotifier>(Assert.Single(withOwn, d => d.ServiceType == typeof(INotifier)).ImplementationInstance);
    }

    [Fact]
    public async Task By_default_only_the_venues_host_may_work_its_door()
    {
        var (host, venue, _, _) = await AloneAsync();
        var other = await app.HostAsync();
        using var scope = app.Services.CreateScope();
        var access = scope.ServiceProvider.GetRequiredService<IVenueAccess>();

        Assert.Equal("Host", await access.DoorNameAsync(host.Id, venue, default));
        Assert.Null(await access.DoorNameAsync(other.Id, venue, default));
    }

    [Fact]
    public async Task The_clock_is_the_real_one_until_a_test_moves_it_and_signed_in_people_stay_signed_in()
    {
        var early = await app.UserAsync();
        using var scope = app.Services.CreateScope();
        var time = scope.ServiceProvider.GetRequiredService<TimeProvider>();
        Assert.Same(app.Clock, time);
        Assert.InRange(time.GetUtcNow().UtcDateTime, DateTime.UtcNow.AddSeconds(-5), DateTime.UtcNow.AddSeconds(5));

        using (app.Clock.At(new DateTime(2031, 5, 2, 23, 30, 0, DateTimeKind.Utc)))
        {
            Assert.Equal(new DateTime(2031, 5, 2, 23, 30, 0, DateTimeKind.Utc), time.GetUtcNow().UtcDateTime);
            app.Clock.Advance(TimeSpan.FromHours(7));
            Assert.Equal(new DateTime(2031, 5, 3, 6, 30, 0, DateTimeKind.Utc), app.Clock.UtcNow);

            var late = await app.UserAsync(); // registers and signs in with the clock years ahead
            Assert.Equal(HttpStatusCode.OK, (await early.Http.GetAsync("/api/bookings/my")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await late.Http.GetAsync("/api/bookings/my")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await app.CreateClient().PostAsJsonAsync("/api/auth/refresh", new { refreshToken = late.Tokens.RefreshToken })).StatusCode);

            app.Clock.SetUtcNow(new DateTimeOffset(2020, 1, 1, 0, 0, 0, TimeSpan.Zero)); // and back in time
            Assert.Equal(2020, app.Clock.UtcNow.Year);
            Assert.Equal(HttpStatusCode.OK, (await early.Http.GetAsync("/api/bookings/my")).StatusCode);
            var again = await app.LoginAsync(early.Email);
            Assert.Equal(HttpStatusCode.OK, (await again.Http.GetAsync("/api/bookings/my")).StatusCode);
        }

        Assert.InRange(app.Clock.UtcNow, DateTime.UtcNow.AddSeconds(-5), DateTime.UtcNow.AddSeconds(5));
    }

    // ── new columns ──

    [Fact]
    public async Task A_new_account_starts_with_a_join_date_no_glow_notifications_on_and_sharing_off()
    {
        var before = DateTime.UtcNow.AddSeconds(-5);
        var actor = await app.UserAsync();
        var id = actor.Id.ToString();

        var user = await app.WithDb(db => db.Users.AsNoTracking().SingleAsync(u => u.Id == id));

        Assert.InRange(user.CreatedAt, before, DateTime.UtcNow.AddSeconds(5));
        Assert.Equal((0, 0), (user.GlowLifetime, user.GlowBalance));
        Assert.Equal((true, true, true), (user.NotifyVenues, user.NotifyFriends, user.NotifyNights));
        Assert.Equal((false, false), (user.ShareWithFriends, user.SharingSuspended));
        Assert.Null(user.DisplayName);
        Assert.Null(user.InvisibleUntil);
        Assert.Equal(user.UserName, PersonName.Display(user));
    }

    [Fact]
    public async Task A_notification_switch_that_is_turned_off_stays_off()
    {
        // "On" is also the database default, which is exactly the case where an "off" can get lost on the way in.
        var id = Guid.NewGuid().ToString();
        await app.WithDb(async db =>
        {
            db.Users.Add(new ApplicationUser { Id = id, UserName = "quiet" + id[..8], NotifyVenues = false, NotifyNights = false });
            return await db.SaveChangesAsync();
        });

        var user = await app.WithDb(db => db.Users.AsNoTracking().SingleAsync(u => u.Id == id));

        Assert.Equal((false, true, false), (user.NotifyVenues, user.NotifyFriends, user.NotifyNights));
    }

    [Fact]
    public async Task A_venue_is_in_podgorica_and_a_party_holds_passes_ninety_minutes_unless_told_otherwise()
    {
        var (_, venueId, partyId, _) = await AloneAsync();

        var venue = await app.WithDb(db => db.VenueProfiles.AsNoTracking().SingleAsync(v => v.Id == venueId));
        var party = await app.WithDb(db => db.Parties.AsNoTracking().SingleAsync(p => p.Id == partyId));
        await app.WithDb(db => db.VenueProfiles.Where(v => v.Id == venueId)
            .ExecuteUpdateAsync(s => s.SetProperty(v => v.Footprint, "[[19.26,42.44],[19.27,42.44],[19.27,42.45],[19.26,42.44]]").SetProperty(v => v.BuildingHeightM, 12.5)));
        var drawn = await app.WithDb(db => db.VenueProfiles.AsNoTracking().SingleAsync(v => v.Id == venueId));

        Assert.Equal("podgorica", venue.CitySlug);
        Assert.Equal((null, null, null, null), (venue.Kind, venue.Area, venue.ImageUrl, venue.Footprint));
        Assert.Equal((90, null), (party.HoldMinutes, party.AgeLimit));
        Assert.Equal(4, JsonSerializer.Deserialize<double[][]>(drawn.Footprint!)!.Length);
        Assert.Equal(12.5, drawn.BuildingHeightM);
    }

    [Fact]
    public async Task The_door_role_exists()
    {
        using var scope = app.Services.CreateScope();

        Assert.True(await scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>().RoleExistsAsync(Roles.Door));
        Assert.Equal("Door", Roles.Door);
    }

    // ── small shared helpers ──

    [Theory]
    [InlineData(0, "Spark", 1, 0, 300)]
    [InlineData(299, "Spark", 1, 0, 300)]
    [InlineData(300, "Ember", 2, 300, 1000)]
    [InlineData(999, "Ember", 2, 300, 1000)]
    [InlineData(1000, "Flame", 3, 1000, 2000)]
    [InlineData(1240, "Flame", 3, 1000, 2000)]
    [InlineData(2000, "Blaze", 4, 2000, 4000)]
    [InlineData(4000, "Inferno", 5, 4000, null)]
    [InlineData(250000, "Inferno", 5, 4000, null)]
    [InlineData(-5, "Spark", 1, 0, 300)]
    public void A_level_comes_from_lifetime_glow(int lifetime, string name, int number, int min, int? next)
    {
        Assert.Equal(new GlowLevel(name, number, min, next), GlowLevels.For(lifetime));
        Assert.Equal(name, GlowLevels.ByNumber(number).Name);
    }

    [Fact]
    public void Names_are_shown_the_same_way_everywhere()
    {
        Assert.Equal("Vule Marković", PersonName.Display(new ApplicationUser { UserName = "vule", DisplayName = "Vule Marković" }));
        Assert.Equal("vule", PersonName.Display(new ApplicationUser { UserName = "vule" }));
        Assert.Equal("vule", PersonName.Display("  ", "vule"));
        Assert.Equal("Guest", PersonName.Display(null, null));

        Assert.Equal("Vule M.", PersonName.Short("Vule Marković"));
        Assert.Equal("Ana Š.", PersonName.Short("Ana Marija  Šćepanović"));
        Assert.Equal("vule", PersonName.Short("vule"));

        Assert.Equal("V", PersonName.Initial("vule"));
        Assert.Equal("Š", PersonName.Initial(" šćepan"));
        Assert.Equal("?", PersonName.Initial(""));
    }

    [Fact]
    public void A_share_page_carries_the_preview_tags_and_opens_the_app()
    {
        var page = new SharePage(new ConfigurationBuilder().Build());

        var html = page.Render("Neon Friday at Monkey", "Fri 13 Nov, 23:00. €5 at the door.", "https://api.test/og.png", "party/3f2a");

        Assert.Contains("<meta property=\"og:title\" content=\"Neon Friday at Monkey\">", html);
        Assert.Contains("<meta property=\"og:description\" content=\"Fri 13 Nov, 23:00. &#x20AC;5 at the door.\">", html);
        Assert.Contains("<meta property=\"og:image\" content=\"https://api.test/og.png\">", html);
        Assert.Contains("href=\"findmypartymobileapp://party/3f2a\"", html);
        Assert.Contains("window.location.replace(\"findmypartymobileapp://party/3f2a\")", html);
        Assert.DoesNotContain("Get FindMyParty", html); // no store address configured
        Assert.Equal("findmypartymobileapp://party/3f2a", page.AppUrl("/party/3f2a"));
    }

    [Fact]
    public void A_share_page_follows_the_settings_and_never_lets_text_become_markup()
    {
        var page = new SharePage(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["App:Scheme"] = "fmpdev",
            ["Share:AppStoreUrl"] = "https://apps.apple.com/app/id1",
        }).Build());

        var html = page.Render("<script>alert(1)</script>", "\"quoted\" & more", null, "reset-password?token=a\"b</script>");

        Assert.DoesNotContain("<script>alert", html);
        Assert.DoesNotContain("b</script>", html);
        Assert.DoesNotContain("og:image", html);
        Assert.Contains("&quot;quoted&quot; &amp; more", html);
        Assert.Contains("href=\"fmpdev://reset-password?token=a&quot;b", html);
        Assert.Contains("<a class=\"store\" href=\"https://apps.apple.com/app/id1\">Get FindMyParty</a>", html);
        Assert.Equal(2, html.Split("<script>").Length); // exactly the one script the page itself brings

        var gone = SharePage.Result(page.NotFound(), StatusCodes.Status404NotFound);
        Assert.Equal((404, "text/html; charset=utf-8"), (gone.StatusCode, gone.ContentType));
        Assert.DoesNotContain("og:", gone.Content);
    }

    [Fact]
    public void A_public_link_uses_the_configured_address_or_else_the_one_the_request_came_in_on()
    {
        HttpContext Request(string? publicBaseUrl)
        {
            var services = new ServiceCollection()
                .AddSingleton<IConfiguration>(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Public:BaseUrl"] = publicBaseUrl }).Build())
                .BuildServiceProvider();
            var context = new DefaultHttpContext { RequestServices = services };
            context.Request.Scheme = "https";
            context.Request.Host = new HostString("api.example.test", 8443);
            return context;
        }

        Assert.Equal("https://api.example.test:8443/p/abc", Links.PublicUrl(Request(null), "/p/abc"));
        Assert.Equal("https://api.example.test:8443/og.png", Links.PublicUrl(Request(""), "og.png"));
        Assert.Equal("https://findmyparty.app/p/abc", Links.PublicUrl(Request("https://findmyparty.app/"), "/p/abc"));
    }

    [Fact]
    public async Task The_share_image_is_served_from_the_api_itself()
    {
        var response = await app.CreateClient().GetAsync("/og.png");
        var bytes = await response.Content.ReadAsByteArrayAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("image/png", response.Content.Headers.ContentType?.MediaType);
        // A PNG says its size in its header: bytes 16–23, big-endian. Share previews want 1200 × 630.
        Assert.Equal((1200, 630), (System.Buffers.Binary.BinaryPrimitives.ReadInt32BigEndian(bytes.AsSpan(16)), System.Buffers.Binary.BinaryPrimitives.ReadInt32BigEndian(bytes.AsSpan(20))));
    }
}
