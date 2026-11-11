using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using FindMyParty.Api.Bookings;
using FindMyParty.Api.Parties;
using FindMyParty.Api.Venues;
using FindMyParty.Api.Common;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Xunit;

namespace FindMyParty.Api.Tests;

/// <summary>The Pass: a booking's rotating door code, scanning it in, and what the host and the public see.</summary>
[Collection("api")]
public class PassTests(TestApp app)
{
    private record PassBody(Guid BookingId, string Secret, int StepSeconds, int TicketCount, int CheckedInCount, string Status, string PartyTitle, string? VenueName);
    private record CheckInBody(Guid BookingId, string GuestName, int Admitted, int TicketCount, int CheckedInCount, decimal AmountDue, string PartyTitle);
    private record Problem(string Title, string Code, DateTime? FirstCheckedInAt);
    private record PreviewBody(Guid BookingId, string GuestName, int TicketCount, int CheckedInCount, int Outside, decimal PricePerGuest, string PartyTitle);
    private record LiveBody(int Capacity, int PassesOut, int CheckedIn, int NotHereYet, decimal TakenAtDoor, List<ArrivalBody> Arrivals);
    private record ArrivalBody(DateTime From, int Count);

    private async Task<(Actor Host, Guid Party, Actor Guest, Guid Booking, PassBody Pass)> BookedAsync(int tickets = 2, decimal price = 5)
    {
        var host = await app.HostAsync();
        var party = await app.PublishedPartyAsync(host, capacity: 50, price: price);
        var guest = await app.UserAsync();
        var booking = await guest.BookedAsync(party, tickets);
        var pass = (await guest.Http.GetFromJsonAsync<PassBody>($"/api/bookings/{booking}/pass"))!;
        return (host, party, guest, booking, pass);
    }

    /// <summary>What the guest's phone shows right now (or `stepsAgo` half-minutes ago).</summary>
    private static string CodeFor(PassBody pass, int stepsAgo = 0) =>
        PassCode.Format(pass.BookingId, PassCode.Compute(pass.Secret, PassCode.StepAt(DateTime.UtcNow) - stepsAgo));

    private static Task<HttpResponseMessage> Scan(Actor host, string code, int? admit = null) =>
        host.Http.PostAsJsonAsync("/api/checkins", new { code, admit });

    // ── the pass ──

    [Fact]
    public async Task A_guest_gets_what_their_phone_needs_to_show_the_pass()
    {
        var (_, _, _, booking, pass) = await BookedAsync(tickets: 2);

        Assert.Equal(booking, pass.BookingId);
        Assert.Equal(30, pass.StepSeconds);
        Assert.Equal(2, pass.TicketCount);
        Assert.Equal("Neon Friday", pass.PartyTitle);
        Assert.Equal("Test venue", pass.VenueName);
        Assert.True(Convert.FromBase64String(pass.Secret).Length >= 20);
    }

    [Fact]
    public async Task Nobody_else_can_fetch_a_guests_pass()
    {
        var (_, _, _, booking, _) = await BookedAsync();

        var response = await (await app.UserAsync()).Http.GetAsync($"/api/bookings/{booking}/pass");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // ── the door ──

    [Fact]
    public async Task Scanning_a_valid_pass_lets_the_guests_in_and_says_what_to_collect()
    {
        var (host, _, guest, booking, pass) = await BookedAsync(tickets: 2, price: 5);

        var response = await Scan(host, CodeFor(pass));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = (await response.Content.ReadFromJsonAsync<CheckInBody>())!;
        Assert.Equal(2, result.Admitted);
        Assert.Equal(2, result.CheckedInCount);
        Assert.Equal(10m, result.AmountDue);
        Assert.False(string.IsNullOrWhiteSpace(result.GuestName));
        Assert.Equal(BookingStatus.Confirmed, await app.WithDb(db => db.Bookings.Where(b => b.Id == booking).Select(b => b.Status).SingleAsync()));
    }

    [Fact]
    public async Task The_code_from_a_moment_ago_still_works_but_an_old_screenshot_does_not()
    {
        var (host, _, _, _, pass) = await BookedAsync();

        var screenshot = await Scan(host, CodeFor(pass, stepsAgo: 6)); // three minutes old
        var justRolledOver = await Scan(host, CodeFor(pass, stepsAgo: 1));

        Assert.Equal(HttpStatusCode.Conflict, screenshot.StatusCode);
        Assert.Equal("code_expired", (await screenshot.Content.ReadFromJsonAsync<Problem>())!.Code);
        Assert.Equal(HttpStatusCode.OK, justRolledOver.StatusCode);
    }

    [Fact]
    public async Task A_pass_that_was_already_used_is_refused_and_says_when()
    {
        var (host, _, _, _, pass) = await BookedAsync();
        (await Scan(host, CodeFor(pass))).EnsureSuccessStatusCode();

        var again = await Scan(host, CodeFor(pass));

        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
        var problem = (await again.Content.ReadFromJsonAsync<Problem>())!;
        Assert.Equal("already_used", problem.Code);
        Assert.NotNull(problem.FirstCheckedInAt);
    }

    [Fact]
    public async Task Part_of_a_group_can_go_in_first_and_the_rest_later()
    {
        var (host, _, _, _, pass) = await BookedAsync(tickets: 3, price: 4);

        var first = (await (await Scan(host, CodeFor(pass), admit: 1)).Content.ReadFromJsonAsync<CheckInBody>())!;
        var rest = (await (await Scan(host, CodeFor(pass))).Content.ReadFromJsonAsync<CheckInBody>())!;
        var nobodyLeft = await Scan(host, CodeFor(pass));

        Assert.Equal((1, 1, 4m), (first.Admitted, first.CheckedInCount, first.AmountDue));
        Assert.Equal((2, 3, 8m), (rest.Admitted, rest.CheckedInCount, rest.AmountDue));
        Assert.Equal(HttpStatusCode.Conflict, nobodyLeft.StatusCode);
    }

    [Fact]
    public async Task Two_doors_scanning_the_same_pass_at_once_let_the_group_in_once()
    {
        var (host, _, _, booking, pass) = await BookedAsync(tickets: 2);

        var responses = await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => Scan(host, CodeFor(pass))));

        Assert.Equal(1, responses.Count(r => r.StatusCode == HttpStatusCode.OK));
        Assert.Equal(7, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));
        Assert.Equal(2, await app.WithDb(db => db.Bookings.Where(b => b.Id == booking).Select(b => b.CheckedInCount).SingleAsync()));
    }

    [Fact]
    public async Task A_cancelled_booking_does_not_get_in()
    {
        var (host, _, guest, booking, pass) = await BookedAsync();
        (await guest.Http.DeleteAsync($"/api/bookings/{booking}")).EnsureSuccessStatusCode();

        var response = await Scan(host, CodeFor(pass));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("booking_cancelled", (await response.Content.ReadFromJsonAsync<Problem>())!.Code);
    }

    [Fact]
    public async Task A_host_cannot_scan_passes_for_someone_elses_party()
    {
        var (_, _, _, _, pass) = await BookedAsync();

        var response = await Scan(await app.HostAsync(), CodeFor(pass));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Theory]
    [InlineData("")]
    [InlineData("hello")]
    [InlineData("fmp1.not-a-guid.12345678")]
    [InlineData("https://example.com/some-other-qr")]
    public async Task Something_that_is_not_a_pass_is_refused_plainly(string code)
    {
        var response = await Scan(await app.HostAsync(), code);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task A_made_up_code_for_a_real_booking_does_not_get_in()
    {
        var (host, _, _, booking, _) = await BookedAsync();

        var response = await Scan(host, PassCode.Format(booking, "00000000"));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task The_door_can_look_at_a_pass_before_letting_anyone_in()
    {
        var (host, _, _, booking, pass) = await BookedAsync(tickets: 3, price: 4);

        var response = await host.Http.PostAsJsonAsync("/api/checkins/preview", new { code = CodeFor(pass) });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var preview = (await response.Content.ReadFromJsonAsync<PreviewBody>())!;
        Assert.Equal((3, 0, 3, 4m), (preview.TicketCount, preview.CheckedInCount, preview.Outside, preview.PricePerGuest));
        Assert.False(string.IsNullOrWhiteSpace(preview.GuestName));
        Assert.Equal(0, await app.WithDb(db => db.Bookings.Where(b => b.Id == booking).Select(b => b.CheckedInCount).SingleAsync()));
    }

    [Fact]
    public async Task Looking_at_a_used_or_expired_pass_gives_the_same_refusals_as_scanning_it()
    {
        var (host, _, _, _, pass) = await BookedAsync();
        var expired = await host.Http.PostAsJsonAsync("/api/checkins/preview", new { code = CodeFor(pass, stepsAgo: 6) });
        (await Scan(host, CodeFor(pass))).EnsureSuccessStatusCode();
        var used = await host.Http.PostAsJsonAsync("/api/checkins/preview", new { code = CodeFor(pass) });

        Assert.Equal("code_expired", (await expired.Content.ReadFromJsonAsync<Problem>())!.Code);
        Assert.Equal("already_used", (await used.Content.ReadFromJsonAsync<Problem>())!.Code);
    }

    [Fact]
    public async Task A_partys_details_include_its_genre_and_performer()
    {
        var party = await app.PublishedPartyAsync(await app.HostAsync());

        var detail = await app.CreateClient().GetFromJsonAsync<PartyDetailResponse>($"/api/parties/{party}");

        Assert.Equal("Techno", detail!.Genre);
    }

    [Fact]
    public async Task My_bookings_say_when_the_guest_was_first_scanned_in()
    {
        var (host, _, guest, booking, pass) = await BookedAsync();
        var before = (await guest.Http.GetFromJsonAsync<List<MyRow>>("/api/bookings/my"))!.Single(b => b.Id == booking);
        (await Scan(host, CodeFor(pass))).EnsureSuccessStatusCode();
        var after = (await guest.Http.GetFromJsonAsync<List<MyRow>>("/api/bookings/my"))!.Single(b => b.Id == booking);

        Assert.Null(before.FirstCheckedInAt);
        Assert.NotNull(after.FirstCheckedInAt);
        Assert.True(Math.Abs((after.FirstCheckedInAt!.Value - DateTime.UtcNow).TotalMinutes) < 2);
    }

    private record MyRow(Guid Id, int CheckedInCount, DateTime? FirstCheckedInAt);

    // ── what the host sees ──

    [Fact]
    public async Task The_host_sees_the_night_in_numbers()
    {
        var host = await app.HostAsync();
        var party = await app.PublishedPartyAsync(host, capacity: 50, price: 5);
        var guests = await Task.WhenAll(Enumerable.Range(0, 3).Select(_ => app.UserAsync()));
        var passes = new List<PassBody>();
        foreach (var g in guests)
        {
            var booking = await g.BookedAsync(party, tickets: 2);
            passes.Add((await g.Http.GetFromJsonAsync<PassBody>($"/api/bookings/{booking}/pass"))!);
        }
        (await Scan(host, CodeFor(passes[0]))).EnsureSuccessStatusCode();
        (await Scan(host, CodeFor(passes[1]), admit: 1)).EnsureSuccessStatusCode();

        var live = (await host.Http.GetFromJsonAsync<LiveBody>($"/api/parties/{party}/live"))!;

        Assert.Equal(50, live.Capacity);
        Assert.Equal(6, live.PassesOut);
        Assert.Equal(3, live.CheckedIn);
        Assert.Equal(3, live.NotHereYet);
        Assert.Equal(15m, live.TakenAtDoor);
        Assert.Equal(3, live.Arrivals.Sum(a => a.Count));
    }

    [Fact]
    public async Task Only_the_partys_host_sees_its_numbers()
    {
        var party = await app.PublishedPartyAsync(await app.HostAsync());

        Assert.Equal(HttpStatusCode.Forbidden, (await (await app.HostAsync()).Http.GetAsync($"/api/parties/{party}/live")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await app.CreateClient().GetAsync($"/api/parties/{party}/live")).StatusCode);
    }

    // ── what everyone sees ──

    [Fact]
    public async Task The_public_sees_a_range_first_from_passes_then_from_the_door()
    {
        var host = await app.HostAsync();
        var party = await app.PublishedPartyAsync(host, capacity: 200, price: 0);
        var passes = new List<PassBody>();
        for (var i = 0; i < 5; i++)
        {
            var g = await app.UserAsync();
            var booking = await g.BookedAsync(party, tickets: 6);
            passes.Add((await g.Http.GetFromJsonAsync<PassBody>($"/api/bookings/{booking}/pass"))!);
        }

        var before = (await app.CreateClient().GetFromJsonAsync<List<PartyResponse>>("/api/parties?pageSize=100"))!.Single(p => p.Id == party);
        foreach (var pass in passes.Take(4)) (await Scan(host, CodeFor(pass))).EnsureSuccessStatusCode();
        var after = (await app.CreateClient().GetFromJsonAsync<List<PartyResponse>>("/api/parties?pageSize=100"))!.Single(p => p.Id == party);

        Assert.Equal(("expected", "20+"), (before.CrowdSource, before.CrowdLevel)); // 30 passes out, nobody scanned yet
        Assert.Equal(("live", "20+"), (after.CrowdSource, after.CrowdLevel));        // 24 inside
    }

    [Fact]
    public async Task A_party_belongs_to_its_hosts_venue_and_the_venue_has_a_public_page()
    {
        var host = await app.HostAsync();
        var party = await app.PublishedPartyAsync(host);

        var listed = (await app.CreateClient().GetFromJsonAsync<List<PartyResponse>>("/api/parties?pageSize=100"))!.Single(p => p.Id == party);
        var venue = await app.CreateClient().GetFromJsonAsync<VenueResponse>($"/api/venues/{listed.VenueId}");

        Assert.Equal("Test venue", listed.VenueName);
        Assert.Equal("Test venue", venue!.Name);
        Assert.Contains(venue.Parties, p => p.Id == party);
    }

    [Fact]
    public async Task Venues_nearby_come_with_tonights_crowd()
    {
        var (lat, lng) = TestApp.NewSpot();
        var host = await app.HostAsync();
        var party = await app.PublishedPartyAsync(host);
        var venueId = (await app.CreateClient().GetFromJsonAsync<PartyDetailResponse>($"/api/parties/{party}"))!.VenueId;
        await app.WithDb(db => db.VenueProfiles.Where(v => v.Id == venueId)
            .ExecuteUpdateAsync(s => s.SetProperty(v => v.Latitude, lat).SetProperty(v => v.Longitude, lng)));
        var near = string.Create(CultureInfo.InvariantCulture, $"lat={lat}&lng={lng}&radiusKm=1&pageSize=100");
        var away = string.Create(CultureInfo.InvariantCulture, $"lat={lat + 1}&lng={lng}&radiusKm=1&pageSize=100");

        var nearby = await app.CreateClient().GetFromJsonAsync<List<VenueSummary>>($"/api/venues?{near}");
        var farAway = await app.CreateClient().GetFromJsonAsync<List<VenueSummary>>($"/api/venues?{away}");

        var mine = nearby!.Single(v => v.Id == venueId);
        Assert.Equal("Test venue", mine.Name);
        Assert.NotNull(mine.CrowdLevel);
        Assert.DoesNotContain(farAway!, v => v.Id == venueId);
    }

    // ── the pass as the phone draws it ──

    [Fact]
    public async Task The_pass_names_its_holder_and_level_and_says_how_many_it_admits_and_what_to_pay()
    {
        var (_, _, guest, booking, _) = await BookedAsync(tickets: 2, price: 5);
        await app.WithDb(db => db.Users.Where(u => u.Id == guest.Id.ToString())
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.DisplayName, "Vule Marković").SetProperty(u => u.GlowLifetime, 1240)));

        var pass = await guest.PassAsync(booking);

        Assert.Equal(("booking", "fmp1", booking.ToString("N")), (pass.Kind, pass.CodePrefix, pass.CodeId));
        Assert.Equal(("Vule M.", "Flame"), (pass.HolderName, pass.LevelName));
        Assert.Equal((2, 10m), (pass.Admit, pass.AmountDue));
        Assert.NotNull(pass.HeldUntil);
        Assert.Null(pass.GuestOf);
    }
}

public class PassCodeTests
{
    [Fact]
    public void The_code_changes_every_half_minute_and_is_stable_within_one()
    {
        var secret = Convert.ToBase64String(new byte[32]);
        var t = new DateTime(2026, 11, 13, 23, 0, 0, DateTimeKind.Utc);

        Assert.Equal(PassCode.StepAt(t), PassCode.StepAt(t.AddSeconds(29)));
        Assert.NotEqual(PassCode.StepAt(t), PassCode.StepAt(t.AddSeconds(30)));
        Assert.NotEqual(PassCode.Compute(secret, PassCode.StepAt(t)), PassCode.Compute(secret, PassCode.StepAt(t.AddSeconds(30))));
    }

    [Fact]
    public void A_known_secret_and_time_give_a_known_code()
    {
        // Fixed vector: the phone's implementation must produce the same eight characters.
        var secret = Convert.ToBase64String(Enumerable.Range(0, 32).Select(i => (byte)i).ToArray());

        Assert.Equal("e88c8498", PassCode.Compute(secret, 59_000_000));
    }

    [Fact]
    public void A_pass_reads_back_into_its_booking_and_code()
    {
        var id = Guid.NewGuid();

        Assert.True(PassCode.TryParse(PassCode.Format(id, "0a1b2c3d"), out var booking, out var code));
        Assert.Equal((id, "0a1b2c3d"), (booking, code));
        Assert.False(PassCode.TryParse("fmp1.nope.0a1b2c3d", out _, out _));
    }
}

/// <summary>What the booking and door tests share: passes, codes, scans, problems, a fake pricer and door logins.</summary>
public static class DoorKit
{
    public record PassBody(
        Guid BookingId, string Kind, string CodePrefix, string CodeId, string Secret, int TicketCount, int CheckedInCount, string Status,
        string PartyTitle, string? VenueName, string? VenueArea, int Admit, decimal AmountDue, string? PerkTitle, bool SkipLine,
        DateTime? HeldUntil, string HolderName, string LevelName, string? GuestOf);

    public record Problem(string Title, string Code, DateTime? FirstCheckedInAt, string? Door, DateTime? HeldUntil);

    public static async Task<PassBody> PassAsync(this Actor guest, Guid bookingId) =>
        (await guest.Http.GetFromJsonAsync<PassBody>($"/api/bookings/{bookingId}/pass"))!;

    public static async Task<PassBody> GuestPassAsync(this Actor guest, Guid guestPassId) =>
        (await guest.Http.GetFromJsonAsync<PassBody>($"/api/guest-passes/{guestPassId}/pass"))!;

    /// <summary>The QR text the pass shows at `at` (default: now on the real clock).</summary>
    public static string Code(this PassBody pass, DateTime? at = null, int stepsAgo = 0) =>
        $"{pass.CodePrefix}.{pass.CodeId}.{PassCode.Compute(pass.Secret, PassCode.StepAt(at ?? DateTime.UtcNow) - stepsAgo)}";

    public static Task<HttpResponseMessage> ScanAsync(this HttpClient door, string code, int? admit = null, Guid? clientScanId = null) =>
        door.PostAsJsonAsync("/api/checkins", new { code, admit, clientScanId });

    public static async Task<Problem> ProblemAsync(this HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<Problem>())!;

    public static HttpClient As(this WebApplicationFactory<Program> host, Actor actor)
    {
        var client = host.CreateClient();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", actor.Tokens.AccessToken);
        return client;
    }

    /// <summary>A host whose only pricer answers what the test says.</summary>
    public static WebApplicationFactory<Program> WithPricer(this TestApp app, FakePricer pricer) => app.WithServices(s =>
    {
        s.RemoveAll<IBookingPricer>();
        s.AddSingleton<IBookingPricer>(pricer);
    });

    public static async Task<Guid> BookedOnAsync(this HttpClient guest, Guid partyId, int tickets)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/bookings") { Content = JsonContent.Create(new { partyId, ticketCount = tickets }) };
        request.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString());
        var response = await guest.SendAsync(request);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<Actor.BookingIdBody>())!.BookingId;
    }

    public record DoorLogin(Guid Id, string Name, string DoorName, string UserName, DateTime CreatedAt, DateTime? LastScanAt, string Password);

    /// <summary>A door login made by the host, signed in.</summary>
    public static async Task<(DoorLogin Login, Actor Door)> DoorLoginAsync(this TestApp app, Actor host, string doorName = "Door 1")
    {
        var created = await host.Http.PostAsJsonAsync("/api/hosts/door-staff", new { name = "Marko", doorName });
        created.EnsureSuccessStatusCode();
        var login = (await created.Content.ReadFromJsonAsync<DoorLogin>())!;
        return (login, await app.LoginAsync(login.UserName, login.Password));
    }

    /// <summary>The next midnight in Podgorica, as UTC: when "free before midnight" runs out.</summary>
    public static DateTime NextMidnight()
    {
        var local = CityClock.Local(DateTime.UtcNow, "podgorica");
        return CityClock.Utc(local.Date.AddDays(1), "podgorica");
    }

    /// <summary>The perk as A5's pricer gives it: the party page's wording, valid until local midnight.</summary>
    public static PerkQuote FreeBeforeMidnight(bool skipLine = false, DateTime? validUntil = null) =>
        new("freeEntryBefore", "Free for you before midnight", 1, 5m, validUntil ?? NextMidnight(), skipLine);

    /// <summary>Moves a party (and so its bookings' party end) in time.</summary>
    public static Task SetTimesAsync(this TestApp app, Guid partyId, DateTime startsAt, DateTime endsAt) =>
        app.WithDb(db => db.Parties.Where(p => p.Id == partyId)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.StartsAt, startsAt).SetProperty(p => p.EndsAt, endsAt)));
}

/// <summary>An IBookingPricer whose answer the test sets.</summary>
public class FakePricer : IBookingPricer
{
    public PerkQuote? Answer { get; set; }
    public int Calls;

    public Task<PerkQuote?> QuoteAsync(Guid userId, Guid partyId, int ticketCount, DateTime nowUtc, CancellationToken ct)
    {
        Interlocked.Increment(ref Calls);
        return Task.FromResult(Answer);
    }
}
