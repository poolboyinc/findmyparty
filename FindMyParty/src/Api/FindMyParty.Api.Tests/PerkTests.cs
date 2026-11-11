using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FindMyParty.Api.Common;
using FindMyParty.Api.Glow;
using FindMyParty.Api.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Xunit;

namespace FindMyParty.Api.Tests;

/// <summary>Level perks, the pricer, sponsored perks, claims and redeeming at the door (spec §2.3 "Perks").</summary>
[Collection("api")]
public class PerkTests(TestApp app)
{
    private static Task<HttpResponseMessage> SwitchAsync(GlowKit.Venue venue, string kind, bool enabled, string? until = null) =>
        venue.Host.Http.PutAsJsonAsync($"/api/hosts/perks/{kind}", new { enabled, untilLocalTime = until });

    private async Task<JsonElement> VenuePageAsync(HttpClient http, Guid venueId) =>
        await http.GetFromJsonAsync<JsonElement>($"/api/venues/{venueId}");

    // ── the host's switches ──

    [Fact]
    public async Task A_host_sees_the_three_perks_off_until_switched_on_and_free_entry_keeps_its_time()
    {
        var venue = await GlowKit.VenueAsync(app);

        var before = await venue.Host.Http.GetFromJsonAsync<List<HostPerk>>("/api/hosts/perks");
        Assert.Equal(
            ["freeEntryBefore Free entry before midnight Flame False 00:00", "skipLine Skip the line Blaze False ", "plusOneFree Bring a +1 free Blaze False "],
            before!.Select(p => $"{p.Kind} {p.Title} {p.MinLevelName} {p.Enabled} {p.UntilLocalTime}"));

        Assert.Equal(HttpStatusCode.NoContent, (await SwitchAsync(venue, "freeEntryBefore", true, "01:00")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await SwitchAsync(venue, "skipLine", true)).StatusCode);
        var after = (await venue.Host.Http.GetFromJsonAsync<List<HostPerk>>("/api/hosts/perks"))!;
        Assert.Equal(("Free entry before 01:00", true, "01:00"), (after[0].Title, after[0].Enabled, after[0].UntilLocalTime));
        Assert.True(after[1].Enabled);

        (await SwitchAsync(venue, "freeEntryBefore", false)).EnsureSuccessStatusCode();
        after = (await venue.Host.Http.GetFromJsonAsync<List<HostPerk>>("/api/hosts/perks"))!;
        Assert.Equal((false, "01:00"), (after[0].Enabled, after[0].UntilLocalTime));

        Assert.Equal(HttpStatusCode.NotFound, (await SwitchAsync(venue, "freeBeer", true)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await SwitchAsync(venue, "freeEntryBefore", true, "25:00")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await (await app.UserAsync()).Http.GetAsync("/api/hosts/perks")).StatusCode);
    }

    [Fact]
    public async Task A_venue_switch_shows_and_hides_the_perk_on_its_page_for_a_guest_at_that_level()
    {
        var venue = await GlowKit.VenueAsync(app);
        var flame = await app.UserAsync();
        var ember = await app.UserAsync();
        await app.SetGlowAsync(flame.Id, 1000);
        await app.SetGlowAsync(ember.Id, 999);

        (await SwitchAsync(venue, "freeEntryBefore", true)).EnsureSuccessStatusCode();
        (await SwitchAsync(venue, "skipLine", true)).EnsureSuccessStatusCode(); // Blaze: not for either

        var page = await VenuePageAsync(flame.Http, venue.Id);
        var perk = Assert.Single(page.GetProperty("perks").EnumerateArray());
        Assert.Equal("freeEntryBefore", perk.GetProperty("perkKey").GetString());
        Assert.Equal("Free entry before midnight", perk.GetProperty("title").GetString());
        Assert.Equal("Flame level, you have it", perk.GetProperty("subtitle").GetString());
        Assert.False(perk.GetProperty("sponsored").GetBoolean());
        Assert.Equal(JsonValueKind.Null, perk.GetProperty("perkId").ValueKind);
        Assert.Empty((await VenuePageAsync(ember.Http, venue.Id)).GetProperty("perks").EnumerateArray());
        Assert.False((await VenuePageAsync(app.CreateClient(), venue.Id)).TryGetProperty("perks", out _));

        (await SwitchAsync(venue, "freeEntryBefore", false)).EnsureSuccessStatusCode();
        Assert.Empty((await VenuePageAsync(flame.Http, venue.Id)).GetProperty("perks").EnumerateArray());
    }

    [Fact]
    public async Task The_perk_list_holds_what_the_level_reaches_and_locks_the_rest()
    {
        var venue = await GlowKit.VenueAsync(app);
        foreach (var kind in new[] { "freeEntryBefore", "skipLine", "plusOneFree" }) (await SwitchAsync(venue, kind, true)).EnsureSuccessStatusCode();
        var guest = await app.UserAsync();
        await app.SetGlowAsync(guest.Id, 1240);

        var list = (await guest.Http.GetFromJsonAsync<List<PerkItem>>("/api/me/perks?city=podgorica"))!;
        var mine = list.Where(p => !p.Sponsored).ToList();

        Assert.Equal(["freeEntryBefore held", "skipLine locked", "plusOneFree locked"], mine.Select(p => $"{p.Id} {p.State}"));
        Assert.Contains(venue.Id, mine[0].VenueIds);
        Assert.EndsWith(", Flame level", mine[0].Subtitle);
        Assert.Equal(("Unlocks at Blaze", "Blaze", 4), (mine[1].Subtitle, mine[1].MinLevelName, mine[1].MinLevel));
        // Held first, locked last.
        Assert.True(list.FindIndex(p => p.State == PerkStates.Held) < list.FindLastIndex(p => p.State == PerkStates.Locked));

        var unknown = await guest.Http.GetAsync("/api/me/perks?city=atlantis");
        Assert.Equal((HttpStatusCode.BadRequest, "city_unknown"), (unknown.StatusCode, await GlowKit.CodeOf(unknown)));
    }

    // ── the pricer ──

    private async Task<PerkQuote?> QuoteAsync(Guid user, Guid party, int tickets, DateTime now)
    {
        using var scope = app.Services.CreateScope();
        var pricer = Assert.Single(scope.ServiceProvider.GetServices<IBookingPricer>());
        return await pricer.QuoteAsync(user, party, tickets, now, CancellationToken.None);
    }

    private static readonly DateTime Start = GlowKit.Local(2026, 11, 13, 23, 0);

    [Fact]
    public async Task Free_entry_covers_one_guest_until_its_time_on_the_party_night()
    {
        var venue = await GlowKit.VenueAsync(app);
        (await SwitchAsync(venue, "freeEntryBefore", true)).EnsureSuccessStatusCode();
        var party = await app.PartyAsync(venue, Start, Start.AddHours(5), price: 5);
        var guest = await app.UserAsync();
        await app.SetGlowAsync(guest.Id, 1000);

        var before = await QuoteAsync(guest.Id, party, 2, GlowKit.Local(2026, 11, 13, 23, 59));
        var after = await QuoteAsync(guest.Id, party, 2, GlowKit.Local(2026, 11, 14, 0, 0));

        Assert.Equal(("freeEntryBefore", "Free for you before midnight", 1, 5m, GlowKit.Local(2026, 11, 14, 0, 0), false),
            (before!.PerkKey, before.Title, before.AppliesToGuests, before.Discount, before.ValidUntil, before.SkipLine));
        Assert.Null(after);

        (await SwitchAsync(venue, "freeEntryBefore", true, "01:00")).EnsureSuccessStatusCode();
        var later = await QuoteAsync(guest.Id, party, 1, GlowKit.Local(2026, 11, 14, 0, 30));
        Assert.Equal(("Free for you before 01:00", GlowKit.Local(2026, 11, 14, 1, 0)), (later!.Title, later.ValidUntil));

        var ember = await app.UserAsync();
        await app.SetGlowAsync(ember.Id, 999);
        Assert.Null(await QuoteAsync(ember.Id, party, 1, GlowKit.Local(2026, 11, 13, 22, 0)));
    }

    [Fact]
    public async Task The_free_plus_one_needs_two_guests_and_Blaze_and_a_tie_goes_to_free_entry()
    {
        var venue = await GlowKit.VenueAsync(app);
        (await SwitchAsync(venue, "plusOneFree", true)).EnsureSuccessStatusCode();
        var party = await app.PartyAsync(venue, Start, Start.AddHours(5), price: 8);
        var blaze = await app.UserAsync();
        var flame = await app.UserAsync();
        await app.SetGlowAsync(blaze.Id, 2000);
        await app.SetGlowAsync(flame.Id, 1999);
        var evening = GlowKit.Local(2026, 11, 13, 21, 0);

        Assert.Null(await QuoteAsync(blaze.Id, party, 1, evening));
        var two = await QuoteAsync(blaze.Id, party, 2, evening);
        Assert.Equal(("plusOneFree", "Your +1 is free", 8m, (DateTime?)null), (two!.PerkKey, two.Title, two.Discount, two.ValidUntil));
        Assert.Null(await QuoteAsync(flame.Id, party, 2, evening));

        (await SwitchAsync(venue, "freeEntryBefore", true)).EnsureSuccessStatusCode();
        Assert.Equal("freeEntryBefore", (await QuoteAsync(blaze.Id, party, 2, evening))!.PerkKey);
        Assert.Equal("plusOneFree", (await QuoteAsync(blaze.Id, party, 2, GlowKit.Local(2026, 11, 14, 0, 30)))!.PerkKey);
    }

    [Fact]
    public async Task Skip_the_line_rides_along_with_no_discount_of_its_own()
    {
        var venue = await GlowKit.VenueAsync(app);
        (await SwitchAsync(venue, "skipLine", true)).EnsureSuccessStatusCode();
        var party = await app.PartyAsync(venue, Start, Start.AddHours(5));
        var blaze = await app.UserAsync();
        await app.SetGlowAsync(blaze.Id, 2500);

        var quote = await QuoteAsync(blaze.Id, party, 1, GlowKit.Local(2026, 11, 13, 21, 0));

        Assert.Equal(((string?)null, 0m, true), (quote!.PerkKey, quote.Discount, quote.SkipLine));
    }

    [Fact]
    public async Task The_party_page_names_the_perk_the_viewer_would_get_now()
    {
        var venue = await GlowKit.VenueAsync(app);
        (await SwitchAsync(venue, "freeEntryBefore", true)).EnsureSuccessStatusCode();
        var party = await app.PartyAsync(venue, Start, Start.AddHours(5));
        var flame = await app.UserAsync();
        await app.SetGlowAsync(flame.Id, 1000);

        using (app.Clock.At(GlowKit.Local(2026, 11, 13, 20, 0)))
        {
            var page = await flame.Http.GetFromJsonAsync<JsonElement>($"/api/parties/{party}");
            var perk = page.GetProperty("perk");
            Assert.Equal(("freeEntryBefore", "freeEntryBefore", "Free for you before midnight"),
                (perk.GetProperty("perkKey").GetString(), perk.GetProperty("kind").GetString(), perk.GetProperty("title").GetString()));
            Assert.False((await app.CreateClient().GetFromJsonAsync<JsonElement>($"/api/parties/{party}")).TryGetProperty("perk", out _));
        }

        (await SwitchAsync(venue, "freeEntryBefore", false)).EnsureSuccessStatusCode();
        (await SwitchAsync(venue, "plusOneFree", true)).EnsureSuccessStatusCode();
        await app.SetGlowAsync(flame.Id, 2000);
        using (app.Clock.At(GlowKit.Local(2026, 11, 13, 20, 0)))
        {
            var page = await flame.Http.GetFromJsonAsync<JsonElement>($"/api/parties/{party}");
            Assert.Equal("Your +1 is free", page.GetProperty("perk").GetProperty("title").GetString());
        }
    }

    // ── sponsored perks and claims ──

    private async Task<PerkItem> SponsoredAsync(GlowKit.Venue venue, int minLevel = 3, int cost = 400, int? stock = 50,
        DateTime? startsAt = null, DateTime? endsAt = null)
    {
        var admin = await app.AdminAsync();
        var response = await admin.Http.PostAsJsonAsync("/api/admin/perks", new
        {
            title = "First drink on VOLT", sponsorName = "VOLT", logoText = "VOLT", colorTop = "#FFD23C", colorBottom = "#ff7a18", ink = "#1a0a00",
            venueId = venue.Id, minLevel, glowCost = cost, stock,
            startsAt = startsAt ?? DateTime.UtcNow.AddHours(-1), endsAt = endsAt ?? DateTime.UtcNow.AddHours(5),
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<PerkItem>())!;
    }

    private static Task<HttpResponseMessage> ClaimAsync(Actor guest, PerkItem perk) => guest.Http.PostAsync($"/api/perks/{perk.Id}/claim", null);

    [Fact]
    public async Task Claiming_spends_balance_keeps_the_level_and_gives_a_code_for_the_venue()
    {
        var venue = await GlowKit.VenueAsync(app);
        var perk = await SponsoredAsync(venue);
        var guest = await app.UserAsync();
        await app.SetGlowAsync(guest.Id, 1240);

        var item = (await guest.Http.GetFromJsonAsync<PerkItem>($"/api/perks/{perk.Id}"))!;
        Assert.Equal(("claimable", "Tonight at Test venue, 400 Glow", "#ffd23c", "Flame"), (item.State, item.Subtitle, item.ColorTop, item.MinLevelName));

        var response = await ClaimAsync(guest, perk);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var claim = (await response.Content.ReadFromJsonAsync<PerkClaimDto>())!;
        Assert.Equal(("claimed", "First drink on VOLT", "Test venue"), (claim.Status, claim.Title, claim.VenueName));
        Assert.Matches("^fmpc1\\.[0-9a-f]{32}\\.[A-Z0-9]{8}$", claim.QrText);
        Assert.StartsWith($"fmpc1.{claim.Id:N}.", claim.QrText);

        Assert.Equal((1240, 840), await app.GlowOfAsync(guest.Id));
        var summary = (await guest.Http.GetFromJsonAsync<GlowSummary>("/api/me/glow"))!;
        Assert.Equal(("Flame", 840, 1240), (summary.Level.Name, summary.Balance, summary.Lifetime));
        var entry = await app.WithDb(db => db.Set<GlowEntry>().SingleAsync(e => e.UserId == guest.Id && e.Kind == GlowKinds.Claim));
        Assert.Equal((-400, claim.Id), (entry.Points, entry.ClaimId));

        var after = (await guest.Http.GetFromJsonAsync<PerkItem>($"/api/perks/{perk.Id}"))!;
        Assert.Equal(("claimed", claim.QrText), (after.State, after.Claim!.QrText));
        var page = await VenuePageAsync(guest.Http, venue.Id);
        var held = Assert.Single(page.GetProperty("perks").EnumerateArray(), p => p.GetProperty("sponsored").GetBoolean());
        Assert.Equal(("Claimed, show the code", perk.Id), (held.GetProperty("subtitle").GetString(), held.GetProperty("perkId").GetString()));
    }

    [Fact]
    public async Task A_claim_is_refused_below_the_level_without_the_glow_when_gone_twice_and_when_not_on()
    {
        var venue = await GlowKit.VenueAsync(app);
        var perk = await SponsoredAsync(venue, stock: 1);
        var (ember, poor, first, late) = (await app.UserAsync(), await app.UserAsync(), await app.UserAsync(), await app.UserAsync());
        await app.SetGlowAsync(ember.Id, 999);
        await app.SetGlowAsync(poor.Id, 1500, balance: 399);
        await app.SetGlowAsync(first.Id, 1500);
        await app.SetGlowAsync(late.Id, 1500);

        async Task Refused(Actor who, PerkItem what, string code)
        {
            var response = await ClaimAsync(who, what);
            Assert.Equal((HttpStatusCode.Conflict, code), (response.StatusCode, await GlowKit.CodeOf(response)));
        }

        await Refused(ember, perk, "perk_level");
        await Refused(poor, perk, "perk_glow");
        Assert.Equal("short", (await poor.Http.GetFromJsonAsync<PerkItem>($"/api/perks/{perk.Id}"))!.State);
        Assert.Equal("locked", (await ember.Http.GetFromJsonAsync<PerkItem>($"/api/perks/{perk.Id}"))!.State);
        (await ClaimAsync(first, perk)).EnsureSuccessStatusCode();
        await Refused(first, perk, "perk_claimed");
        await Refused(late, perk, "perk_gone");
        Assert.Equal((1500, 1500), await app.GlowOfAsync(late.Id)); // nothing spent on a refusal

        var tomorrow = await SponsoredAsync(venue, startsAt: DateTime.UtcNow.AddDays(1), endsAt: DateTime.UtcNow.AddDays(1).AddHours(5));
        await Refused(late, tomorrow, "perk_not_live");
        var admin = await app.AdminAsync();
        var off = await SponsoredAsync(venue);
        Assert.Equal(HttpStatusCode.NoContent, (await admin.Http.DeleteAsync($"/api/admin/perks/{off.Id}")).StatusCode);
        await Refused(late, off, "perk_not_live");
        Assert.Equal(HttpStatusCode.NotFound, (await late.Http.GetAsync($"/api/perks/{off.Id}")).StatusCode);
    }

    [Fact]
    public async Task Two_claims_at_once_on_the_last_one_give_it_once()
    {
        var venue = await GlowKit.VenueAsync(app);
        var perk = await SponsoredAsync(venue, stock: 1);
        var guests = new List<Actor>();
        for (var i = 0; i < 6; i++)
        {
            var g = await app.UserAsync();
            await app.SetGlowAsync(g.Id, 1500);
            guests.Add(g);
        }

        var answers = await Task.WhenAll(guests.Select(g => ClaimAsync(g, perk)));

        Assert.Single(answers, a => a.StatusCode == HttpStatusCode.OK);
        Assert.Equal(1, await app.WithDb(db => db.Set<PerkClaim>().CountAsync(c => c.PerkId == Guid.Parse(perk.Id))));
        var spent = 0;
        foreach (var g in guests) spent += 1500 - (await app.GlowOfAsync(g.Id)).Balance;
        Assert.Equal(400, spent);
    }

    [Fact]
    public async Task Sponsored_perks_are_listed_after_the_held_ones_and_locked_ones_last()
    {
        var venue = await GlowKit.VenueAsync(app);
        (await SwitchAsync(venue, "freeEntryBefore", true)).EnsureSuccessStatusCode();
        var open = await SponsoredAsync(venue, minLevel: 3);
        var blazeOnly = await SponsoredAsync(venue, minLevel: 4);
        var guest = await app.UserAsync();
        await app.SetGlowAsync(guest.Id, 1240);

        var list = (await guest.Http.GetFromJsonAsync<List<PerkItem>>("/api/me/perks?city=podgorica"))!;
        int At(string id) => list.FindIndex(p => p.Id == id);

        Assert.True(At("freeEntryBefore") < At(open.Id));
        Assert.True(At(open.Id) < At(blazeOnly.Id));
        Assert.Equal(("claimable", true, "VOLT"), (list[At(open.Id)].State, list[At(open.Id)].Sponsored, list[At(open.Id)].LogoText));
        Assert.Equal(("locked", "Unlocks at Blaze"), (list[At(blazeOnly.Id)].State, list[At(blazeOnly.Id)].Subtitle));
    }

    [Fact]
    public async Task Only_an_admin_makes_sponsored_perks_and_the_input_is_checked()
    {
        var venue = await GlowKit.VenueAsync(app);
        var admin = await app.AdminAsync();
        object Body(string colour, int minLevel = 3) => new
        {
            title = "Free shot", sponsorName = "AURA", logoText = "AURA", colorTop = colour, colorBottom = "#ffb020", ink = "#ffb020",
            venueId = venue.Id, minLevel, glowCost = 100, stock = (int?)null, startsAt = DateTime.UtcNow, endsAt = DateTime.UtcNow.AddHours(2),
        };

        Assert.Equal(HttpStatusCode.Forbidden, (await venue.Host.Http.PostAsJsonAsync("/api/admin/perks", Body("#ffb020"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.Http.PostAsJsonAsync("/api/admin/perks", Body("orange"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.Http.PostAsJsonAsync("/api/admin/perks", Body("#ffb020", minLevel: 6))).StatusCode);
        var made = await admin.Http.PostAsJsonAsync("/api/admin/perks", Body("#ffb020"));
        Assert.Equal(HttpStatusCode.OK, made.StatusCode);
        var id = (await made.Content.ReadFromJsonAsync<PerkItem>())!.Id;
        Assert.Contains((await admin.Http.GetFromJsonAsync<List<PerkItem>>("/api/admin/perks"))!, p => p.Id == id);
    }

    // ── redeeming at the door ──

    private async Task<PerkClaimDto> ClaimedAsync(GlowKit.Venue venue, Actor guest, DateTime? endsAt = null)
    {
        var perk = await SponsoredAsync(venue, endsAt: endsAt);
        await app.SetGlowAsync(guest.Id, 1500);
        var response = await ClaimAsync(guest, perk);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<PerkClaimDto>())!;
    }

    [Fact]
    public async Task The_venues_host_redeems_a_claim_once_and_another_venue_cannot()
    {
        var venue = await GlowKit.VenueAsync(app);
        var other = await GlowKit.VenueAsync(app);
        var guest = await app.UserAsync();
        await app.WithDb(db => db.Users.Where(u => u.Id == guest.Id.ToString()).ExecuteUpdateAsync(s => s.SetProperty(u => u.DisplayName, "Vule Marković")));
        var claim = await ClaimedAsync(venue, guest);

        var elsewhere = await other.Host.Http.PostAsJsonAsync("/api/perk-claims/redeem", new { code = claim.QrText });
        var guestTries = await guest.Http.PostAsJsonAsync("/api/perk-claims/redeem", new { code = claim.QrText });
        var redeemed = await venue.Host.Http.PostAsJsonAsync("/api/perk-claims/redeem", new { code = claim.QrText });
        var twice = await venue.Host.Http.PostAsJsonAsync("/api/perk-claims/redeem", new { code = claim.QrText });
        var forged = await venue.Host.Http.PostAsJsonAsync("/api/perk-claims/redeem", new { code = claim.QrText[..^8] + "ZZZZZZZZ" });
        var nonsense = await venue.Host.Http.PostAsJsonAsync("/api/perk-claims/redeem", new { code = "fmp1.abc.123" });

        Assert.Equal(HttpStatusCode.Forbidden, elsewhere.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, guestTries.StatusCode);
        Assert.Equal(HttpStatusCode.OK, redeemed.StatusCode);
        var result = (await redeemed.Content.ReadFromJsonAsync<RedeemResult>())!;
        Assert.Equal((claim.Id, "First drink on VOLT", "Vule M."), (result.ClaimId, result.Title, result.GuestName));
        Assert.Equal((HttpStatusCode.Conflict, "claim_used"), (twice.StatusCode, await GlowKit.CodeOf(twice)));
        Assert.Equal((HttpStatusCode.BadRequest, "invalid_code"), (forged.StatusCode, await GlowKit.CodeOf(forged)));
        Assert.Equal((HttpStatusCode.BadRequest, "invalid_code"), (nonsense.StatusCode, await GlowKit.CodeOf(nonsense)));
        var after = (await guest.Http.GetFromJsonAsync<PerkItem>($"/api/perks/{claim.PerkId}"))!;
        Assert.Equal("redeemed", after.Claim!.Status);
    }

    private class DoorOf(Guid doorUser, Guid venueId) : IVenueAccess
    {
        public Task<string?> DoorNameAsync(Guid userId, Guid venue, CancellationToken ct) =>
            Task.FromResult(userId == doorUser && venue == venueId ? "Door 1" : null);
    }

    [Fact]
    public async Task A_door_login_of_the_venue_redeems_through_the_venue_access_check()
    {
        var venue = await GlowKit.VenueAsync(app);
        var guest = await app.UserAsync();
        var claim = await ClaimedAsync(venue, guest);
        var door = await app.WithRoleAsync(Roles.Door);
        var stranger = await app.WithRoleAsync(Roles.Door);
        using var host = app.WithServices(s =>
        {
            s.RemoveAll<IVenueAccess>();
            s.AddScoped<IVenueAccess>(_ => new DoorOf(door.Id, venue.Id));
        });
        HttpClient As(Actor a)
        {
            var http = host.CreateClient();
            http.DefaultRequestHeaders.Authorization = a.Http.DefaultRequestHeaders.Authorization;
            return http;
        }

        Assert.Equal(HttpStatusCode.Forbidden, (await As(stranger).PostAsJsonAsync("/api/perk-claims/redeem", new { code = claim.QrText })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await As(door).PostAsJsonAsync("/api/perk-claims/redeem", new { code = claim.QrText })).StatusCode);
    }

    [Fact]
    public async Task A_claim_expires_when_its_perk_ends()
    {
        var venue = await GlowKit.VenueAsync(app);
        var guest = await app.UserAsync();
        var endsAt = DateTime.UtcNow.AddHours(2);
        var claim = await ClaimedAsync(venue, guest, endsAt);

        using (app.Clock.At(endsAt.AddMinutes(1)))
        {
            var late = await venue.Host.Http.PostAsJsonAsync("/api/perk-claims/redeem", new { code = claim.QrText });
            Assert.Equal((HttpStatusCode.Conflict, "claim_expired"), (late.StatusCode, await GlowKit.CodeOf(late)));
            Assert.Equal("expired", (await guest.Http.GetFromJsonAsync<PerkItem>($"/api/perks/{claim.PerkId}"))!.Claim!.Status);
        }
    }
}
