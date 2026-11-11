using System.Net;
using System.Net.Http.Json;
using FindMyParty.Api.Common;
using FindMyParty.Api.Identity;
using FindMyParty.Api.Data;
using FindMyParty.Api.Demo;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace FindMyParty.Api.Tests;

/// <summary>The door: door logins, door names, perks at the door, idempotent and offline scans, the door's context and list.</summary>
[Collection("api")]
public class DoorTests(TestApp app)
{
    private record Result(Guid BookingId, string GuestName, string LevelName, int Admitted, int TicketCount, int CheckedInCount,
        decimal AmountDue, string PartyTitle, string Door, Guid? ClientScanId);
    private record Line(string Label, decimal Amount, bool Perk);
    private record Preview(Guid BookingId, string Kind, string GuestName, string LevelName, int Outside, decimal PricePerGuest,
        List<Line> Lines, List<decimal> DueByAdmit, bool SkipLine);
    private record BatchResult(Guid ClientScanId, string Status, Result? Result, string? Code, string? Title);
    private record BatchBody(List<BatchResult> Results);
    private record ContextParty(Guid Id, string Title, int Capacity, int CheckedIn);
    private record Context(Guid VenueId, string VenueName, string DoorName, string Role, ContextParty? Party);
    private record ManifestPass(string CodeId, string Kind, string GuestName, string LevelName, int Outside, decimal PricePerGuest,
        List<decimal> DueByAdmit, bool SkipLine, string? PerkLabel);
    private record Manifest(Guid PartyId, string PartyTitle, int Capacity, int CheckedIn, List<ManifestPass> Passes);
    private record Staff(Guid Id, string Name, string DoorName, string UserName, DateTime? LastScanAt);

    private async Task<(Actor Host, Guid Party)> PartyAsync(int capacity = 50, decimal price = 5)
    {
        var host = await app.HostAsync();
        return (host, await app.PublishedPartyAsync(host, capacity: capacity, price: price));
    }

    private async Task<(Actor Guest, Guid Booking, DoorKit.PassBody Pass)> GuestAsync(Guid party, int tickets = 2)
    {
        var guest = await app.UserAsync();
        var booking = await guest.BookedAsync(party, tickets);
        return (guest, booking, await guest.PassAsync(booking));
    }

    // ── door logins ──

    [Fact]
    public async Task A_host_makes_a_door_login_that_signs_in_with_its_user_name_and_a_generated_password()
    {
        var (host, _) = await PartyAsync();

        var (login, door) = await app.DoorLoginAsync(host, "Door 1");

        Assert.Matches("^test-venue-door[0-9]+$", login.UserName);
        Assert.Matches("^[A-Za-z0-9]{10}$", login.Password);
        Assert.Equal(("Marko", "Door 1"), (login.Name, login.DoorName));
        var roles = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler().ReadJwtToken(door.Tokens.AccessToken).Claims
            .Where(c => c.Type is "role" or System.Security.Claims.ClaimTypes.Role).Select(c => c.Value);
        Assert.Equal([Roles.Door], roles);
        var listed = Assert.Single((await host.Http.GetFromJsonAsync<List<Staff>>("/api/hosts/door-staff"))!);
        Assert.Equal((login.Id, login.UserName, (DateTime?)null), (listed.Id, listed.UserName, listed.LastScanAt));
    }

    [Theory]
    [InlineData("", "Door 1")]
    [InlineData("Marko", "")]
    [InlineData("Marko", "A door name that is far too long to fit on the block")]
    public async Task A_door_login_needs_a_name_and_a_door_name_of_one_to_forty_characters(string name, string doorName)
    {
        var (host, _) = await PartyAsync();

        var response = await host.Http.PostAsJsonAsync("/api/hosts/door-staff", new { name, doorName });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("name_invalid", (await response.ProblemAsync()).Code);
    }

    [Fact]
    public async Task A_venue_has_at_most_ten_door_logins()
    {
        var (host, _) = await PartyAsync();
        for (var i = 1; i <= 10; i++)
            (await host.Http.PostAsJsonAsync("/api/hosts/door-staff", new { name = "Staff", doorName = $"Door {i}" })).EnsureSuccessStatusCode();

        var eleventh = await host.Http.PostAsJsonAsync("/api/hosts/door-staff", new { name = "Staff", doorName = "Door 11" });

        Assert.Equal(HttpStatusCode.Conflict, eleventh.StatusCode);
        Assert.Equal("door_staff_limit", (await eleventh.ProblemAsync()).Code);
    }

    [Fact]
    public async Task A_door_login_scans_at_its_venue_under_its_door_name()
    {
        var (host, party) = await PartyAsync(price: 5);
        var (_, door) = await app.DoorLoginAsync(host, "Door 2");
        var (_, booking, pass) = await GuestAsync(party);

        var response = await door.Http.ScanAsync(pass.Code());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = (await response.Content.ReadFromJsonAsync<Result>())!;
        Assert.Equal(("Door 2", 2, 10m), (result.Door, result.Admitted, result.AmountDue));
        var scan = await app.WithDb(db => db.CheckIns.SingleAsync(c => c.BookingId == booking));
        Assert.Equal(("Door 2", door.Id, 10m), (scan.DoorName, scan.ByUserId, scan.AmountDue));
        Assert.NotNull(Assert.Single((await host.Http.GetFromJsonAsync<List<Staff>>("/api/hosts/door-staff"))!).LastScanAt);
    }

    [Fact]
    public async Task A_door_login_is_refused_at_another_venue_and_sees_no_money_totals()
    {
        var (host, party) = await PartyAsync();
        var (_, door) = await app.DoorLoginAsync(host);
        var (_, otherParty) = await PartyAsync();
        var (_, _, otherPass) = await GuestAsync(otherParty);

        Assert.Equal(HttpStatusCode.Forbidden, (await door.Http.ScanAsync(otherPass.Code())).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await door.Http.GetAsync($"/api/door/manifest?partyId={otherParty}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await door.Http.GetAsync($"/api/parties/{party}/live")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await door.Http.GetAsync($"/api/bookings/party/{party}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await door.Http.GetAsync("/api/hosts/door-staff")).StatusCode);
    }

    [Fact]
    public async Task Removing_a_door_login_ends_its_session()
    {
        var (host, party) = await PartyAsync();
        var (login, door) = await app.DoorLoginAsync(host);
        var (_, _, pass) = await GuestAsync(party);

        Assert.Equal(HttpStatusCode.NoContent, (await host.Http.DeleteAsync($"/api/hosts/door-staff/{login.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await host.Http.DeleteAsync($"/api/hosts/door-staff/{login.Id}")).StatusCode);

        Assert.Equal(HttpStatusCode.Forbidden, (await door.Http.ScanAsync(pass.Code())).StatusCode); // its access token is still unexpired
        Assert.Equal(HttpStatusCode.Forbidden, (await door.Http.GetAsync("/api/door/context")).StatusCode);
        var refresh = await app.CreateClient().PostAsJsonAsync("/api/auth/refresh", new { refreshToken = door.Tokens.RefreshToken });
        Assert.Equal(HttpStatusCode.Unauthorized, refresh.StatusCode);
        var login2 = await app.CreateClient().PostAsJsonAsync("/api/auth/login", new { email = login.UserName, password = login.Password });
        Assert.Equal(HttpStatusCode.Unauthorized, login2.StatusCode);
        Assert.Empty((await host.Http.GetFromJsonAsync<List<Staff>>("/api/hosts/door-staff"))!);
    }

    [Fact]
    public async Task A_reset_password_replaces_the_old_one_and_signs_the_old_phone_out()
    {
        var (host, _) = await PartyAsync();
        var (login, door) = await app.DoorLoginAsync(host);

        var reset = await host.Http.PostAsync($"/api/hosts/door-staff/{login.Id}/reset-password", null);
        var password = (await reset.Content.ReadFromJsonAsync<PasswordBody>())!.Password;

        Assert.NotEqual(login.Password, password);
        Assert.Equal(HttpStatusCode.Unauthorized, (await app.CreateClient().PostAsJsonAsync("/api/auth/login", new { email = login.UserName, password = login.Password })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await app.CreateClient().PostAsJsonAsync("/api/auth/login", new { email = login.UserName, password })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await app.CreateClient().PostAsJsonAsync("/api/auth/refresh", new { refreshToken = door.Tokens.RefreshToken })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await (await app.HostAsync()).Http.PostAsync($"/api/hosts/door-staff/{login.Id}/reset-password", null)).StatusCode);
    }

    private record PasswordBody(string Password);

    // ── what the door is told ──

    [Fact]
    public async Task A_used_pass_says_when_and_at_which_door_it_was_first_scanned()
    {
        var (host, party) = await PartyAsync();
        var (_, door) = await app.DoorLoginAsync(host, "Door 2");
        var (_, _, pass) = await GuestAsync(party);
        (await door.Http.ScanAsync(pass.Code())).EnsureSuccessStatusCode();

        var problem = await (await host.Http.ScanAsync(pass.Code())).ProblemAsync();

        Assert.Equal(("already_used", "Door 2"), (problem.Code, problem.Door));
        Assert.NotNull(problem.FirstCheckedInAt);
    }

    [Fact]
    public async Task The_same_client_scan_id_twice_lets_the_group_in_once_and_answers_the_same()
    {
        var (host, party) = await PartyAsync();
        var (_, booking, pass) = await GuestAsync(party, tickets: 3);
        var id = Guid.NewGuid();

        var first = await host.Http.ScanAsync(pass.Code(), admit: 2, clientScanId: id);
        var retries = await Task.WhenAll(Enumerable.Range(0, 4).Select(_ => host.Http.ScanAsync(pass.Code(), admit: 2, clientScanId: id)));

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.All(retries, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
        var answers = await Task.WhenAll(retries.Prepend(first).Select(r => r.Content.ReadFromJsonAsync<Result>()));
        Assert.All(answers, a => Assert.Equal((2, "Host", (Guid?)id), (a!.Admitted, a.Door, a.ClientScanId)));
        Assert.Equal(2, await app.WithDb(db => db.Bookings.Where(b => b.Id == booking).Select(b => b.CheckedInCount).SingleAsync()));
        Assert.Equal(1, await app.WithDb(db => db.CheckIns.CountAsync(c => c.BookingId == booking)));
    }

    [Fact]
    public async Task Concurrent_scans_with_one_client_scan_id_record_one_scan()
    {
        var (host, party) = await PartyAsync();
        var (_, booking, pass) = await GuestAsync(party, tickets: 2);
        var id = Guid.NewGuid();

        var responses = await Task.WhenAll(Enumerable.Range(0, 6).Select(_ => host.Http.ScanAsync(pass.Code(), clientScanId: id)));

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
        Assert.Equal(1, await app.WithDb(db => db.CheckIns.CountAsync(c => c.BookingId == booking)));
    }

    // ── perks at the door ──

    private async Task<(Actor Host, Guid Party, Actor Guest, Guid Booking)> PerkBookingAsync(int tickets, DateTime? validUntil = null, bool skipLine = false)
    {
        var (host, party) = await PartyAsync(price: 5);
        var guest = await app.UserAsync();
        using var priced = app.WithPricer(new FakePricer { Answer = DoorKit.FreeBeforeMidnight(skipLine, validUntil) });
        return (host, party, guest, await priced.As(guest).BookedOnAsync(party, tickets));
    }

    [Fact]
    public async Task The_door_sees_the_perk_line_and_what_to_collect_for_one_or_two()
    {
        var (host, _, guest, booking) = await PerkBookingAsync(2, skipLine: true);
        await app.WithDb(db => db.Users.Where(u => u.Id == guest.Id.ToString())
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.DisplayName, "Vule Marković").SetProperty(u => u.GlowLifetime, 1240)));

        var preview = (await (await host.Http.PostAsJsonAsync("/api/checkins/preview", new { code = (await guest.PassAsync(booking)).Code() }))
            .Content.ReadFromJsonAsync<Preview>())!;

        Assert.Equal(("Vule M.", "Flame", "booking", 2, true), (preview.GuestName, preview.LevelName, preview.Kind, preview.Outside, preview.SkipLine));
        Assert.Equal([new Line("Entry, 2 × €5", 10m, false), new Line("Free before midnight (1 guest)", -5m, true)], preview.Lines);
        Assert.Equal([0m, 5m], preview.DueByAdmit);
    }

    [Fact]
    public async Task The_discount_is_taken_on_the_first_admission_only()
    {
        var (host, _, guest, booking) = await PerkBookingAsync(3);
        var pass = await guest.PassAsync(booking);

        var first = (await (await host.Http.ScanAsync(pass.Code(), admit: 1)).Content.ReadFromJsonAsync<Result>())!;
        var rest = (await (await host.Http.ScanAsync(pass.Code(), admit: 2)).Content.ReadFromJsonAsync<Result>())!;

        Assert.Equal(0m, first.AmountDue);
        Assert.Equal(10m, rest.AmountDue);
        var row = (await guest.Http.GetFromJsonAsync<List<DueRow>>("/api/bookings/my"))!.Single(b => b.Id == booking);
        Assert.Equal((3, 0m), (row.CheckedInCount, row.AmountDue));
    }

    [Fact]
    public async Task A_free_plus_one_reads_as_such_at_the_door()
    {
        var (host, party) = await PartyAsync(price: 5);
        var guest = await app.UserAsync();
        using var priced = app.WithPricer(new FakePricer { Answer = new PerkQuote("plusOneFree", "Your +1 is free", 1, 5m, null, false) });
        var booking = await priced.As(guest).BookedOnAsync(party, 2);

        var preview = (await (await host.Http.PostAsJsonAsync("/api/checkins/preview", new { code = (await guest.PassAsync(booking)).Code() }))
            .Content.ReadFromJsonAsync<Preview>())!;

        Assert.Equal(new Line("Free +1 (1 guest)", -5m, true), preview.Lines[1]);
    }

    private record DueRow(Guid Id, int CheckedInCount, decimal AmountDue);

    [Fact]
    public async Task The_discount_is_gone_once_the_perk_has_run_out()
    {
        var validUntil = DateTime.UtcNow.AddMinutes(30);
        var (host, _, guest, booking) = await PerkBookingAsync(2, validUntil);
        var pass = await guest.PassAsync(booking);
        Assert.Equal(5m, pass.AmountDue);

        var later = validUntil.AddMinutes(1);
        using var _ = app.Clock.At(later);
        var preview = (await (await host.Http.PostAsJsonAsync("/api/checkins/preview", new { code = pass.Code(later) })).Content.ReadFromJsonAsync<Preview>())!;
        var result = (await (await host.Http.ScanAsync(pass.Code(later))).Content.ReadFromJsonAsync<Result>())!;

        Assert.Single(preview.Lines);
        Assert.Equal([5m, 10m], preview.DueByAdmit);
        Assert.Equal(10m, result.AmountDue);
    }

    // ── offline ──

    private static object Item(Guid id, string code, int admit, DateTime scannedAt) => new { clientScanId = id, code, admit, scannedAt };

    [Fact]
    public async Task Offline_scans_are_replayed_at_the_moment_they_were_made_and_each_is_reported()
    {
        var (host, party) = await PartyAsync();
        var (_, door) = await app.DoorLoginAsync(host, "Door 1");
        var (_, okBooking, ok) = await GuestAsync(party, tickets: 2);
        var (_, _, used) = await GuestAsync(party, tickets: 1);
        (await host.Http.ScanAsync(used.Code())).EnsureSuccessStatusCode();
        var (_, _, stale) = await GuestAsync(party, tickets: 1);
        var now = DateTime.UtcNow;
        var tenMinutesAgo = now.AddMinutes(-10);
        var (a, b, c, d) = (Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());

        var body = new
        {
            items = new[]
            {
                Item(a, ok.Code(tenMinutesAgo), 2, tenMinutesAgo),                // the code of ten minutes ago, checked then
                Item(b, used.Code(now.AddMinutes(-2)), 1, now.AddMinutes(-2)),     // already in through another door
                Item(c, stale.Code(now.AddMinutes(-20)), 1, now.AddMinutes(-20)),  // too long ago
                Item(d, "not a pass", 1, now),
            }
        };
        var response = await door.Http.PostAsJsonAsync("/api/checkins/batch", body);
        var again = await door.Http.PostAsJsonAsync("/api/checkins/batch", new { items = new[] { Item(a, ok.Code(tenMinutesAgo), 2, tenMinutesAgo) } });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var results = (await response.Content.ReadFromJsonAsync<BatchBody>())!.Results;
        Assert.Equal([a, b, c, d], results.Select(r => r.ClientScanId));
        Assert.Equal(("admitted", 2, "Door 1"), (results[0].Status, results[0].Result!.Admitted, results[0].Result!.Door));
        Assert.Equal(("refused", "already_used"), (results[1].Status, results[1].Code));
        Assert.Equal(("refused", "offline_too_old"), (results[2].Status, results[2].Code));
        Assert.Equal(("refused", "invalid_code"), (results[3].Status, results[3].Code));
        Assert.False(string.IsNullOrWhiteSpace(results[2].Title));

        var replayed = Assert.Single((await again.Content.ReadFromJsonAsync<BatchBody>())!.Results);
        Assert.Equal(("admitted", 2), (replayed.Status, replayed.Result!.Admitted));
        var scan = await app.WithDb(db => db.CheckIns.SingleAsync(x => x.BookingId == okBooking));
        Assert.Equal(tenMinutesAgo, scan.At, TimeSpan.FromMilliseconds(1));
        Assert.Equal((a, "Door 1"), (scan.ClientScanId!.Value, scan.DoorName));
    }

    [Fact]
    public async Task A_batch_holds_at_most_a_hundred_scans()
    {
        var (host, _) = await PartyAsync();
        var items = Enumerable.Range(0, 101).Select(_ => Item(Guid.NewGuid(), "x", 1, DateTime.UtcNow)).ToArray();

        var response = await host.Http.PostAsJsonAsync("/api/checkins/batch", new { items });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ── context and the list for no signal ──

    [Fact]
    public async Task The_door_learns_its_venue_its_name_and_the_party_on_now()
    {
        var (host, party) = await PartyAsync(capacity: 300);
        await app.SetTimesAsync(party, DateTime.UtcNow.AddHours(-1), DateTime.UtcNow.AddHours(4));
        var (_, door) = await app.DoorLoginAsync(host, "Door 1");
        var (_, _, pass) = await GuestAsync(party, tickets: 2);
        (await door.Http.ScanAsync(pass.Code())).EnsureSuccessStatusCode();

        var asDoor = (await door.Http.GetFromJsonAsync<Context>("/api/door/context"))!;
        var asHost = (await host.Http.GetFromJsonAsync<Context>("/api/door/context"))!;

        Assert.Equal(("Test venue", "Door 1", "door"), (asDoor.VenueName, asDoor.DoorName, asDoor.Role));
        Assert.Equal((party, 300, 2), (asDoor.Party!.Id, asDoor.Party.Capacity, asDoor.Party.CheckedIn));
        Assert.Equal(("Host", "host", asDoor.VenueId), (asHost.DoorName, asHost.Role, asHost.VenueId));
    }

    [Fact]
    public async Task Before_the_doors_open_the_context_names_the_party_starting_within_six_hours()
    {
        var (soonHost, soon) = await PartyAsync();
        await app.SetTimesAsync(soon, DateTime.UtcNow.AddHours(5), DateTime.UtcNow.AddHours(10));
        var (laterHost, later) = await PartyAsync();
        await app.SetTimesAsync(later, DateTime.UtcNow.AddHours(7), DateTime.UtcNow.AddHours(12));

        Assert.Equal(soon, (await soonHost.Http.GetFromJsonAsync<Context>("/api/door/context"))!.Party!.Id);
        Assert.Null((await laterHost.Http.GetFromJsonAsync<Context>("/api/door/context"))!.Party);
        Assert.Equal(HttpStatusCode.Forbidden, (await (await app.UserAsync()).Http.GetAsync("/api/door/context")).StatusCode);
    }

    [Fact]
    public async Task The_list_for_no_signal_has_every_code_still_to_come_in_with_what_to_collect()
    {
        var (host, party) = await PartyAsync(price: 5);
        var (_, door) = await app.DoorLoginAsync(host);
        var (_, inBooking, inPass) = await GuestAsync(party, tickets: 1);
        (await host.Http.ScanAsync(inPass.Code())).EnsureSuccessStatusCode();
        var (cancelledGuest, cancelled, _) = await GuestAsync(party, tickets: 1);
        (await cancelledGuest.Http.DeleteAsync($"/api/bookings/{cancelled}")).EnsureSuccessStatusCode();
        var guest = await app.UserAsync();
        using (var priced = app.WithPricer(new FakePricer { Answer = DoorKit.FreeBeforeMidnight() }))
        {
            var booking = await priced.As(guest).BookedOnAsync(party, 3);
            var given = (await (await guest.Http.PostAsync($"/api/bookings/{booking}/guest-passes", null)).Content.ReadFromJsonAsync<GiveBody>())!;
            var friend = await app.UserAsync();
            (await friend.Http.PostAsJsonAsync("/api/guest-passes/claim", new { token = given.Url[(given.Url.LastIndexOf('/') + 1)..] })).EnsureSuccessStatusCode();

            var manifest = (await door.Http.GetFromJsonAsync<Manifest>($"/api/door/manifest?partyId={party}"))!;

            Assert.Equal((party, 1), (manifest.PartyId, manifest.CheckedIn));
            Assert.Equal(2, manifest.Passes.Count);
            var main = manifest.Passes.Single(p => p.Kind == "booking");
            Assert.Equal((booking.ToString("N"), 2, "Free before midnight"), (main.CodeId, main.Outside, main.PerkLabel));
            Assert.Equal([0m, 5m], main.DueByAdmit);
            var theirs = manifest.Passes.Single(p => p.Kind == "guest");
            Assert.Equal((given.Id.ToString("N"), 1, (string?)null), (theirs.CodeId, theirs.Outside, theirs.PerkLabel));
            Assert.Equal([5m], theirs.DueByAdmit);
            Assert.DoesNotContain(manifest.Passes, p => p.CodeId == inBooking.ToString("N") || p.CodeId == cancelled.ToString("N"));
        }
    }

    // ── demo ──

    [Fact]
    public async Task The_demo_gives_Monkey_two_door_logins_and_splits_its_scans_between_them()
    {
        var database = "door_" + Guid.NewGuid().ToString("N")[..10];
        using var seeded = app.With(new()
        {
            ["ConnectionStrings:DefaultConnection"] = app.ConnectionStringFor(database),
            ["Seed:Demo"] = "true",
            ["Seed:DoorPassword"] = "door-demo-123",
        });
        var client = seeded.CreateClient();
        using var scope = seeded.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<DemoSeeder>().EnsureAsync(); // a second run adds nothing
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var staff = await db.Set<FindMyParty.Api.Door.DoorStaff>().OrderBy(s => s.DoorName).ToListAsync();
        Assert.Equal(["Door 1", "Door 2"], staff.Select(s => s.DoorName));
        var monkey = staff[0].VenueId;
        var scans = await db.CheckIns.Where(c => db.Parties.Any(p => p.Id == c.PartyId && p.VenueId == monkey)).ToListAsync();
        Assert.NotEmpty(scans);
        Assert.Equal(["Door 1", "Door 2"], scans.Select(c => c.DoorName).Distinct().Order());
        Assert.All(await db.CheckIns.ToListAsync(), c => Assert.True(c.AmountDue > 0 || db.Parties.Single(p => p.Id == c.PartyId).Price == 0));

        var login = await client.PostAsJsonAsync("/api/auth/login", new { email = "monkey-door1", password = "door-demo-123" });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
    }

    private record GiveBody(Guid Id, string Url);
}
