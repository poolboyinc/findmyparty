using System.Net;
using System.Net.Http.Json;
using FindMyParty.Api.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace FindMyParty.Api.Tests;

/// <summary>"Send to a guest": a link worth one spot of a booking; the guest gets their own code and pays their own entry.</summary>
[Collection("api")]
public class GuestPassTests(TestApp app)
{
    private record GuestPassBody(Guid Id, string Status, string? GuestName, string Url, DateTime CreatedAt);
    private record PreviewBody(string PartyTitle, string? VenueName, DateTime StartsAt, string HostName, string Status);
    private record Row(Guid Id, Guid PartyId, int TicketCount, decimal TotalPrice, string Status, int CheckedInCount, decimal AmountDue,
        List<GuestPassBody> GuestPasses, Guid? GuestPassId, string? GuestOf);

    private static string TokenOf(GuestPassBody pass) => pass.Url[(pass.Url.LastIndexOf('/') + 1)..];

    private async Task<(Actor Host, Guid Party, Actor Booker, Guid Booking)> BookedAsync(int tickets = 3, decimal price = 5)
    {
        var host = await app.HostAsync();
        var party = await app.PublishedPartyAsync(host, capacity: 50, price: price);
        var booker = await app.UserAsync();
        await app.WithDb(db => db.Users.Where(u => u.Id == booker.Id.ToString()).ExecuteUpdateAsync(s => s.SetProperty(u => u.DisplayName, "Vule Marković")));
        return (host, party, booker, await booker.BookedAsync(party, tickets));
    }

    private static async Task<HttpResponseMessage> CreateAsync(Actor booker, Guid booking) =>
        await booker.Http.PostAsync($"/api/bookings/{booking}/guest-passes", null);

    private static async Task<GuestPassBody> CreatedAsync(Actor booker, Guid booking)
    {
        var response = await CreateAsync(booker, booking);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<GuestPassBody>())!;
    }

    private static Task<HttpResponseMessage> ClaimAsync(Actor guest, GuestPassBody pass) =>
        guest.Http.PostAsJsonAsync("/api/guest-passes/claim", new { token = TokenOf(pass) });

    private async Task<Actor> ClaimedByNewGuestAsync(GuestPassBody pass, string name = "Mila Perić")
    {
        var guest = await app.UserAsync();
        await app.WithDb(db => db.Users.Where(u => u.Id == guest.Id.ToString()).ExecuteUpdateAsync(s => s.SetProperty(u => u.DisplayName, name)));
        (await ClaimAsync(guest, pass)).EnsureSuccessStatusCode();
        return guest;
    }

    private static async Task<Row> MineAsync(Actor actor, Guid id) =>
        (await actor.Http.GetFromJsonAsync<List<Row>>("/api/bookings/my"))!.Single(r => r.Id == id);

    // ── handing out ──

    [Fact]
    public async Task The_booker_makes_a_link_and_sees_it_on_the_booking()
    {
        var (_, _, booker, booking) = await BookedAsync(tickets: 2);

        var pass = await CreatedAsync(booker, booking);
        var row = await MineAsync(booker, booking);

        Assert.Equal(("unclaimed", (string?)null), (pass.Status, pass.GuestName));
        Assert.Matches("^https?://[^/]+/g/[0-9a-f]{32}$", pass.Url);
        Assert.Equal(pass.Id, Assert.Single(row.GuestPasses).Id);
        Assert.Equal(1, (await booker.PassAsync(booking)).Admit); // the booker's own code now lets one in
    }

    [Fact]
    public async Task The_booker_keeps_a_spot_of_their_own_until_they_are_inside()
    {
        var (host, _, booker, booking) = await BookedAsync(tickets: 3);
        await CreatedAsync(booker, booking);
        await CreatedAsync(booker, booking);

        var third = await CreateAsync(booker, booking);
        Assert.Equal(HttpStatusCode.Conflict, third.StatusCode);
        Assert.Equal("no_spot_to_give", (await third.ProblemAsync()).Code);

        // Two of three handed out, the booker goes in: nothing left to give.
        (await host.Http.ScanAsync((await booker.PassAsync(booking)).Code())).EnsureSuccessStatusCode();
        Assert.Equal("no_spot_to_give", (await (await CreateAsync(booker, booking)).ProblemAsync()).Code);
    }

    [Fact]
    public async Task Once_inside_the_booker_may_hand_out_every_spot_still_outside()
    {
        var (host, _, booker, booking) = await BookedAsync(tickets: 3);
        (await host.Http.ScanAsync((await booker.PassAsync(booking)).Code(), admit: 1)).EnsureSuccessStatusCode();

        Assert.Equal(HttpStatusCode.OK, (await CreateAsync(booker, booking)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await CreateAsync(booker, booking)).StatusCode); // before going in, this last spot was the booker's own
        Assert.Equal(HttpStatusCode.Conflict, (await CreateAsync(booker, booking)).StatusCode);
        Assert.Equal(0, (await booker.PassAsync(booking)).Admit);
    }

    [Fact]
    public async Task Nobody_else_can_hand_out_a_spot_of_my_booking()
    {
        var (_, _, _, booking) = await BookedAsync();

        Assert.Equal(HttpStatusCode.Forbidden, (await CreateAsync(await app.UserAsync(), booking)).StatusCode);
    }

    // ── taking it ──

    [Fact]
    public async Task Anyone_can_look_at_a_link_before_signing_in_and_it_names_who_sent_it()
    {
        var (_, _, booker, booking) = await BookedAsync();
        var pass = await CreatedAsync(booker, booking);

        var before = await app.CreateClient().GetFromJsonAsync<PreviewBody>($"/api/guest-passes/preview/{TokenOf(pass)}");
        await ClaimedByNewGuestAsync(pass);
        var after = await app.CreateClient().GetFromJsonAsync<PreviewBody>($"/api/guest-passes/preview/{TokenOf(pass)}");
        var unknown = await app.CreateClient().GetAsync($"/api/guest-passes/preview/{new string('0', 32)}");

        Assert.Equal(("Neon Friday", "Test venue", "Vule", "open"), (before!.PartyTitle, before.VenueName, before.HostName, before.Status));
        Assert.Equal("taken", after!.Status);
        Assert.Equal(HttpStatusCode.NotFound, unknown.StatusCode);
    }

    [Fact]
    public async Task A_guest_takes_the_pass_and_the_booker_is_told()
    {
        var (_, party, booker, booking) = await BookedAsync(tickets: 3, price: 5);
        var pass = await CreatedAsync(booker, booking);
        var guest = await app.UserAsync();
        await app.WithDb(db => db.Users.Where(u => u.Id == guest.Id.ToString()).ExecuteUpdateAsync(s => s.SetProperty(u => u.DisplayName, "Mila Perić")));

        var response = await ClaimAsync(guest, pass);
        var again = await ClaimAsync(guest, pass);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, again.StatusCode); // taking it twice is harmless
        var row = (await response.Content.ReadFromJsonAsync<Row>())!;
        Assert.Equal((pass.Id, party, 1, 5m, "Pending", 5m, "Vule"), (row.Id, row.PartyId, row.TicketCount, row.TotalPrice, row.Status, row.AmountDue, row.GuestOf));
        Assert.Equal(pass.Id, row.GuestPassId);
        var push = Assert.Single(app.Notifier.SentTo(booker.Id, "guest_pass_claimed"));
        Assert.Equal(("Mila took your guest pass", "Neon Friday"), (push.Title, push.Body));
        var given = Assert.Single((await MineAsync(booker, booking)).GuestPasses);
        Assert.Equal(("claimed", "Mila P."), (given.Status, given.GuestName));
    }

    [Fact]
    public async Task The_booker_cannot_take_their_own_pass()
    {
        var (_, _, booker, booking) = await BookedAsync();
        var pass = await CreatedAsync(booker, booking);

        var response = await ClaimAsync(booker, pass);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("guest_pass_own", (await response.ProblemAsync()).Code);
    }

    [Fact]
    public async Task A_pass_someone_took_cannot_be_taken_by_another()
    {
        var (_, _, booker, booking) = await BookedAsync();
        var pass = await CreatedAsync(booker, booking);
        await ClaimedByNewGuestAsync(pass);

        var response = await ClaimAsync(await app.UserAsync(), pass);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("guest_pass_taken", (await response.ProblemAsync()).Code);
    }

    [Fact]
    public async Task One_guest_holds_at_most_one_pass_of_a_booking()
    {
        var (_, _, booker, booking) = await BookedAsync(tickets: 4);
        var first = await CreatedAsync(booker, booking);
        var second = await CreatedAsync(booker, booking);
        var guest = await ClaimedByNewGuestAsync(first);

        var response = await ClaimAsync(guest, second);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("guest_pass_own", (await response.ProblemAsync()).Code);
    }

    [Fact]
    public async Task A_link_for_a_party_that_is_over_cannot_be_taken()
    {
        var (_, party, booker, booking) = await BookedAsync();
        var pass = await CreatedAsync(booker, booking);
        await app.SetTimesAsync(party, DateTime.UtcNow.AddHours(-6), DateTime.UtcNow.AddMinutes(-1));

        var response = await ClaimAsync(await app.UserAsync(), pass);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("party_over", (await response.ProblemAsync()).Code);
    }

    // ── taking it back ──

    [Fact]
    public async Task The_booker_takes_a_pass_back_and_the_spot_returns_to_their_own_code()
    {
        var (_, _, booker, booking) = await BookedAsync(tickets: 2);
        var pass = await CreatedAsync(booker, booking);
        var guest = await ClaimedByNewGuestAsync(pass);

        var response = await booker.Http.DeleteAsync($"/api/guest-passes/{pass.Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(2, (await booker.PassAsync(booking)).Admit);
        Assert.Empty((await MineAsync(booker, booking)).GuestPasses); // taken back: no longer listed
        Assert.Equal("Cancelled", (await MineAsync(guest, pass.Id)).Status);
        Assert.Equal("gone", (await app.CreateClient().GetFromJsonAsync<PreviewBody>($"/api/guest-passes/preview/{TokenOf(pass)}"))!.Status);
        Assert.Equal(HttpStatusCode.NotFound, (await ClaimAsync(await app.UserAsync(), pass)).StatusCode);
    }

    [Fact]
    public async Task The_guest_can_give_it_back_but_a_stranger_cannot_take_it_away()
    {
        var (_, _, booker, booking) = await BookedAsync(tickets: 2);
        var pass = await CreatedAsync(booker, booking);
        var guest = await ClaimedByNewGuestAsync(pass);

        Assert.Equal(HttpStatusCode.Forbidden, (await (await app.UserAsync()).Http.DeleteAsync($"/api/guest-passes/{pass.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await guest.Http.DeleteAsync($"/api/guest-passes/{pass.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await guest.Http.DeleteAsync($"/api/guest-passes/{pass.Id}")).StatusCode);
    }

    [Fact]
    public async Task A_guest_who_is_inside_cannot_be_taken_back()
    {
        var (host, _, booker, booking) = await BookedAsync(tickets: 2);
        var pass = await CreatedAsync(booker, booking);
        var guest = await ClaimedByNewGuestAsync(pass);
        (await host.Http.ScanAsync((await guest.GuestPassAsync(pass.Id)).Code())).EnsureSuccessStatusCode();

        var response = await booker.Http.DeleteAsync($"/api/guest-passes/{pass.Id}");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("guest_inside", (await response.ProblemAsync()).Code);
    }

    [Fact]
    public async Task Cancelling_the_booking_takes_its_guest_passes_back()
    {
        var (_, party, booker, booking) = await BookedAsync(tickets: 3);
        var pass = await CreatedAsync(booker, booking);
        var guest = await ClaimedByNewGuestAsync(pass);

        (await booker.Http.DeleteAsync($"/api/bookings/{booking}")).EnsureSuccessStatusCode();

        Assert.Equal(0, await app.TicketsSoldAsync(party));
        Assert.NotNull(await app.WithDb(db => db.Set<FindMyParty.Api.Bookings.GuestPass>().Where(g => g.Id == pass.Id).Select(g => g.RevokedAt).SingleAsync()));
        var guestPass = await guest.GuestPassAsync(pass.Id);
        Assert.Equal(("Cancelled", 0), (guestPass.Status, guestPass.Admit));
    }

    // ── at the door ──

    [Fact]
    public async Task The_guest_has_their_own_code_that_lets_exactly_one_in_at_full_price()
    {
        var (host, party, booker, _) = await BookedAsync(tickets: 3, price: 5);
        var pricer = new FakePricer { Answer = new PerkQuote("freeEntryBefore", "Free before midnight (you)", 1, 5, null, true) };
        using var priced = app.WithPricer(pricer);
        var perkBooking = await priced.As(booker).BookedOnAsync(party, 2); // a booking that has a perk: the guest does not get it
        var pass = await CreatedAsync(booker, perkBooking);
        var guest = await ClaimedByNewGuestAsync(pass);

        var guestPass = await guest.GuestPassAsync(pass.Id);
        var preview = (await (await host.Http.PostAsJsonAsync("/api/checkins/preview", new { code = guestPass.Code() })).Content.ReadFromJsonAsync<GuestPreview>())!;
        var scan = await host.Http.ScanAsync(guestPass.Code(), admit: 2);
        var scanned = await host.Http.ScanAsync(guestPass.Code());
        var again = await host.Http.ScanAsync(guestPass.Code());

        Assert.Equal(("guest", "fmpg1", pass.Id.ToString("N"), 1, 5m), (guestPass.Kind, guestPass.CodePrefix, guestPass.CodeId, guestPass.Admit, guestPass.AmountDue));
        Assert.Equal(("Mila P.", "Spark", "Vule", (string?)null, false), (guestPass.HolderName, guestPass.LevelName, guestPass.GuestOf, guestPass.PerkTitle, guestPass.SkipLine));
        Assert.Equal(("guest", 1, false), (preview.Kind, preview.Outside, preview.SkipLine));
        Assert.Equal([5m], preview.DueByAdmit);
        Assert.Equal("Entry, 1 × €5", Assert.Single(preview.Lines).Label);
        Assert.Equal(HttpStatusCode.BadRequest, scan.StatusCode); // a guest pass admits one
        var result = (await scanned.Content.ReadFromJsonAsync<GuestResult>())!;
        Assert.Equal((pass.Id, 1, 5m, "Mila P."), (result.BookingId, result.Admitted, result.AmountDue, result.GuestName));
        Assert.Equal("already_used", (await again.ProblemAsync()).Code);
        Assert.Equal(1, (await booker.PassAsync(perkBooking)).Admit);
    }

    private record Line(string Label, decimal Amount, bool Perk);
    private record GuestPreview(Guid BookingId, string Kind, int Outside, List<Line> Lines, List<decimal> DueByAdmit, bool SkipLine);
    private record GuestResult(Guid BookingId, int Admitted, decimal AmountDue, string GuestName);

    [Fact]
    public async Task With_a_guest_pass_out_the_bookers_code_lets_fewer_in()
    {
        var (host, _, booker, booking) = await BookedAsync(tickets: 3, price: 5);
        await CreatedAsync(booker, booking);
        var pass = await booker.PassAsync(booking);

        var tooMany = await host.Http.ScanAsync(pass.Code(), admit: 3);
        var all = (await (await host.Http.ScanAsync(pass.Code())).Content.ReadFromJsonAsync<GuestResult>())!;

        Assert.Equal(HttpStatusCode.BadRequest, tooMany.StatusCode);
        Assert.Equal((2, 10m), (all.Admitted, all.AmountDue));
        Assert.Equal("already_used", (await (await host.Http.ScanAsync(pass.Code())).ProblemAsync()).Code);
    }

    private class Recorder : ICheckInListener
    {
        public List<CheckInEvent> Events { get; } = [];
        public Task OnCheckedInAsync(CheckInEvent e, CancellationToken ct)
        {
            lock (Events) Events.Add(e);
            return Task.CompletedTask;
        }
    }

    [Fact]
    public async Task A_guest_scan_counts_on_the_booking_and_tells_listeners_the_guest_and_the_guest_pass_id()
    {
        var recorder = new Recorder();
        using var listening = app.WithServices(s => s.AddSingleton<ICheckInListener>(recorder));
        var (host, party, booker, booking) = await BookedAsync(tickets: 3);
        var pass = await CreatedAsync(booker, booking);
        var guest = await ClaimedByNewGuestAsync(pass);

        (await listening.As(host).ScanAsync((await guest.GuestPassAsync(pass.Id)).Code())).EnsureSuccessStatusCode();

        var heard = Assert.Single(recorder.Events);
        Assert.Equal((pass.Id, party, guest.Id, 1, true), (heard.BookingId, heard.PartyId, heard.GuestUserId, heard.Admitted, heard.FirstForGuest));
        var row = await MineAsync(booker, booking);
        Assert.Equal(1, row.CheckedInCount); // the booking's count includes its guests
        Assert.Equal("in", Assert.Single(row.GuestPasses).Status);
        Assert.Equal(0, (await booker.PassAsync(booking)).CheckedInCount); // the booker's own code has not been scanned
        var guestRow = await MineAsync(guest, pass.Id);
        Assert.Equal((1, 0m), (guestRow.CheckedInCount, guestRow.AmountDue));
        var scan = await app.WithDb(db => db.CheckIns.SingleAsync(c => c.Id == heard.CheckInId));
        Assert.Equal((booking, pass.Id, guest.Id, 5m), (scan.BookingId, scan.GuestPassId!.Value, scan.GuestUserId, scan.AmountDue));
    }

    // ── the share page ──

    [Fact]
    public async Task The_link_opens_a_page_that_says_who_sent_it_and_opens_the_app()
    {
        var (_, _, booker, booking) = await BookedAsync();
        var pass = await CreatedAsync(booker, booking);

        var page = await app.CreateClient().GetAsync($"/g/{TokenOf(pass)}");
        var html = await page.Content.ReadAsStringAsync();
        var unknown = await app.CreateClient().GetAsync($"/g/{new string('0', 32)}");

        Assert.Equal(HttpStatusCode.OK, page.StatusCode);
        Assert.Contains("<meta property=\"og:title\" content=\"Vule sent you a pass\">", html);
        Assert.Contains("Neon Friday at Test venue", html);
        Assert.Contains($"findmypartymobileapp://guest-pass/{TokenOf(pass)}", html);
        Assert.Contains("/og.png", html);
        Assert.DoesNotContain((await app.WithDb(db => db.Set<FindMyParty.Api.Bookings.GuestPass>().SingleAsync(g => g.Id == pass.Id))).PassSecret, html);
        Assert.Equal(HttpStatusCode.NotFound, unknown.StatusCode);
    }
}
