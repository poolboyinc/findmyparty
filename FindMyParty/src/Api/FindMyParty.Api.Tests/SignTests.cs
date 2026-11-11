using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using FindMyParty.Api.Common;
using FindMyParty.Api.Demo;
using FindMyParty.Api.Signs;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace FindMyParty.Api.Tests;

/// <summary>Helpers for SignTests and SignReviewTests.</summary>
public static class SignKit
{
    private static int _numbers = Random.Shared.Next(1000, 100000);

    /// <summary>A new spot made by the admin, with a number nothing else uses.</summary>
    public static async Task<SignSpotDto> SpotAsync(this Actor admin, string city = "podgorica", string format = "facade",
        Guid? venueId = null, decimal? price = null, bool active = true)
    {
        var response = await admin.Http.PostAsJsonAsync("/api/admin/sign-spots", SpotBody(city, format, Interlocked.Increment(ref _numbers), venueId, price, active));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<SignSpotDto>())!;
    }

    public static object SpotBody(string city, string format, int number, Guid? venueId = null, decimal? price = null, bool active = true) => new
    {
        city, number, format, label = "Njegoševa", area = "Stara Varoš", latitude = 42.440313, longitude = 19.263993, bearingDeg = 202,
        baseHeightM = 3.4, widthM = 16, heightM = 8.5, buildingHeightM = 17, venueId, weeklyPrice = price, active,
    };

    /// <summary>A host whose venue is in this city.</summary>
    public static async Task<(Actor Host, Guid Venue)> HostInAsync(this TestApp app, string city = "podgorica")
    {
        var host = await app.HostAsync();
        var key = host.Id.ToString();
        var venue = await app.WithDb(async db =>
        {
            var v = await db.VenueProfiles.SingleAsync(x => x.UserId == key);
            v.CitySlug = city;
            v.VenueName = "Venue " + key[..6];
            await db.SaveChangesAsync();
            return v.Id;
        });
        return (host, venue);
    }

    public static object Sign(string format = "facade", Guid? spotId = null, string? week = null, Guid? partyId = null,
        string text = "NEON|FRIDAY", string colorTop = "#ec5b93", string colorBottom = "#7b2ff7", string ink = "#ffffff") =>
        new { format, spotId, week, partyId, text, colorTop, colorBottom, ink };

    public static Task<HttpResponseMessage> BookSignAsync(this Actor host, object body) => host.Http.PostAsJsonAsync("/api/hosts/signs", body);

    public static async Task<SignBookingDto> BookedSignAsync(this Actor host, object body)
    {
        var response = await host.BookSignAsync(body);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<SignBookingDto>())!;
    }

    public static async Task<SignOptions> SignOptionsAsync(this Actor host, string? week = null) =>
        (await host.Http.GetFromJsonAsync<SignOptions>("/api/hosts/signs/options" + (week is null ? "" : $"?week={week}")))!;

    public static async Task ApproveSignAsync(this Actor admin, Guid id) =>
        (await admin.Http.PostAsync($"/api/admin/signs/{id}/approve", null)).EnsureSuccessStatusCode();

    public static async Task<List<MapSign>> MapAsync(this HttpClient http, string city = "podgorica") =>
        (await http.GetFromJsonAsync<List<MapSign>>($"/api/signs?city={city}"))!;

    /// <summary>A published party of this host starting at this moment, on a spot of its own.</summary>
    public static async Task<Guid> PartyAtAsync(this Actor host, DateTime startsAt, double hours = 5)
    {
        var (lat, lng) = TestApp.NewSpot();
        var created = await host.Http.PostAsJsonAsync("/api/parties", new
        {
            title = "Signed night", description = "", price = 5, capacity = 50, startsAt, endsAt = startsAt.AddHours(hours),
            latitude = lat, longitude = lng, genre = "Techno",
        });
        created.EnsureSuccessStatusCode();
        var id = (await created.Content.ReadFromJsonAsync<TestApp.IdBody>())!.Id;
        (await host.Http.PostAsync($"/api/parties/{id}/publish", null)).EnsureSuccessStatusCode();
        return id;
    }

    public static string ThisWeek(DateTime utc, string city = "podgorica") => SignRules.WeekId(SignRules.Monday(SignRules.Today(utc, city)));
    public static string WeeksOn(DateTime utc, int weeks) => SignRules.WeekId(SignRules.Monday(SignRules.Today(utc, "podgorica")).AddDays(7 * weeks));
}

/// <summary>Spots, booking by the week, tonight slots, the map's signs and the sponsored party.</summary>
[Collection("api")]
public class SignTests(TestApp app)
{
    // ── weeks ──

    [Fact]
    public async Task Weeks_run_Monday_to_Sunday_in_city_time_and_nine_can_be_booked()
    {
        var (host, _) = await app.HostInAsync();
        using var _ = app.Clock.At(new DateTime(2026, 11, 11, 12, 0, 0, DateTimeKind.Utc)); // Wednesday

        var options = await host.SignOptionsAsync();

        Assert.Equal(9, options.Weeks.Count);
        Assert.Equal(new SignWeek("2026-W46", new DateOnly(2026, 11, 9), new DateOnly(2026, 11, 15), "This week"), options.Week);
        Assert.Equal(["This week", "Next week", "23–29 Nov", "30 Nov–6 Dec"], options.Weeks.Take(4).Select(w => w.Label));
        Assert.Equal(("2026-W53", "2027-W01", new DateOnly(2027, 1, 4)), (options.Weeks[^2].Id, options.Weeks[^1].Id, options.Weeks[^1].StartsOn));
        Assert.Equal("2026-W48", (await host.SignOptionsAsync("2026-W48")).Week.Id);
        Assert.Equal(HttpStatusCode.BadRequest, (await host.Http.GetAsync("/api/hosts/signs/options?week=2026-W45")).StatusCode); // last week
        Assert.Equal(HttpStatusCode.BadRequest, (await host.Http.GetAsync("/api/hosts/signs/options?week=2027-W03")).StatusCode); // ten weeks on
        Assert.Equal(HttpStatusCode.BadRequest, (await host.Http.GetAsync("/api/hosts/signs/options?week=soon")).StatusCode);
    }

    [Fact]
    public async Task One_in_the_morning_on_Monday_still_belongs_to_last_week()
    {
        var (host, _) = await app.HostInAsync();
        using var _ = app.Clock.At(new DateTime(2026, 11, 16, 0, 0, 0, DateTimeKind.Utc)); // Monday 01:00 in Podgorica

        Assert.Equal("2026-W46", (await host.SignOptionsAsync()).Week.Id);
        app.Clock.SetUtcNow(new DateTimeOffset(2026, 11, 16, 5, 0, 0, TimeSpan.Zero)); // 06:00
        Assert.Equal("2026-W47", (await host.SignOptionsAsync()).Week.Id);
    }

    // ── options ──

    [Fact]
    public async Task Options_count_the_spots_free_each_week_and_leave_out_other_venues_own_walls()
    {
        const string city = "tivat"; // no other test puts spots here
        var admin = await app.AdminAsync();
        var (host, venue) = await app.HostInAsync(city);
        var (rival, rivalVenue) = await app.HostInAsync(city);
        var a = await admin.SpotAsync(city);
        await admin.SpotAsync(city);
        await admin.SpotAsync(city);
        var ownWall = await admin.SpotAsync(city, venueId: venue);
        var rivalWall = await admin.SpotAsync(city, venueId: rivalVenue);
        await admin.SpotAsync(city, active: false);
        await admin.SpotAsync(city, "hologram");
        await rival.BookedSignAsync(SignKit.Sign(spotId: a.Id));

        var thisWeek = await host.SignOptionsAsync();
        var nextWeek = await host.SignOptionsAsync(thisWeek.Weeks[1].Id);

        var facade = thisWeek.Formats.Single(f => f.Format == "facade");
        Assert.Equal(("Facade panel", 40m, "week", 4, 3), (facade.Title, facade.Price, facade.Unit, facade.Total, facade.Free));
        var hologram = thisWeek.Formats.Single(f => f.Format == "hologram");
        Assert.Equal(("Rooftop hologram", 90m, 1, 1), (hologram.Title, hologram.Price, hologram.Total, hologram.Free));
        var slot = thisWeek.Formats.Single(f => f.Format == "tonightSlot");
        Assert.Equal(("Slot in Tonight", 15m, "night", 2, 2), (slot.Title, slot.Price, slot.Unit, slot.Total, slot.Free));
        Assert.Equal(["facade", "hologram", "tonightSlot"], thisWeek.Formats.Select(f => f.Format));
        Assert.DoesNotContain(thisWeek.Spots, s => s.Id == rivalWall.Id);
        Assert.Contains(thisWeek.Spots, s => s.Id == ownWall.Id && s.Free);
        Assert.False(thisWeek.Spots.Single(s => s.Id == a.Id).Free);
        Assert.Equal(4, nextWeek.Formats.Single(f => f.Format == "facade").Free);
        Assert.True(nextWeek.Spots.Single(s => s.Id == a.Id).Free);
        // The rival sees its own wall, and not the host's.
        var rivals = await rival.SignOptionsAsync();
        Assert.Contains(rivals.Spots, s => s.Id == rivalWall.Id);
        Assert.DoesNotContain(rivals.Spots, s => s.Id == ownWall.Id);
    }

    [Fact]
    public async Task Options_list_the_hosts_parties_still_to_come_and_their_signs_newest_first()
    {
        var admin = await app.AdminAsync();
        var (host, _) = await app.HostInAsync();
        var party = await app.PublishedPartyAsync(host);
        var draft = await app.DraftPartyAsync(host);
        var first = await host.BookedSignAsync(SignKit.Sign(spotId: (await admin.SpotAsync()).Id));
        var second = await host.BookedSignAsync(SignKit.Sign(spotId: (await admin.SpotAsync()).Id, partyId: party));

        var options = await host.SignOptionsAsync();

        Assert.Equal([party], options.Parties.Select(p => p.Id));
        Assert.DoesNotContain(options.Parties, p => p.Id == draft);
        Assert.Equal([second.Id, first.Id], options.Mine.Select(m => m.Id));
        Assert.Equal("Neon Friday", options.Mine[0].PartyTitle);
    }

    // ── booking ──

    [Fact]
    public async Task A_booking_waits_for_review_for_the_week_asked_at_the_spots_price_to_invoice()
    {
        var admin = await app.AdminAsync();
        var (host, _) = await app.HostInAsync();
        var spot = await admin.SpotAsync(price: 55);
        var now = DateTime.UtcNow;

        var sign = await host.BookedSignAsync(SignKit.Sign(spotId: spot.Id, week: SignKit.WeeksOn(now, 2)));

        Assert.Equal(("facade", "pendingReview", "toInvoice", 55m), (sign.Format, sign.Status, sign.InvoiceStatus, sign.Price));
        Assert.Equal(("NEON|FRIDAY", "#ec5b93", "#7b2ff7", "#ffffff"), (sign.Text, sign.ColorTop, sign.ColorBottom, sign.Ink));
        var monday = SignRules.Monday(SignRules.Today(now, "podgorica")).AddDays(14);
        Assert.Equal((monday, monday.AddDays(6)), (sign.StartsOn, sign.EndsOn));
        Assert.Equal(spot.Id, sign.Spot!.Id);
        Assert.False(sign.Spot.Free);
    }

    [Fact]
    public async Task Prices_come_from_the_spot_then_from_settings()
    {
        var admin = await app.AdminAsync();
        var (host, _) = await app.HostInAsync();
        var facade = await admin.SpotAsync();
        var hologram = await admin.SpotAsync(format: "hologram");
        var party = await app.PublishedPartyAsync(host);

        Assert.Equal(40m, (await host.BookedSignAsync(SignKit.Sign(spotId: facade.Id))).Price);
        Assert.Equal(90m, (await host.BookedSignAsync(SignKit.Sign("hologram", hologram.Id))).Price);
        Assert.Equal(15m, (await host.BookedSignAsync(SignKit.Sign("tonightSlot", partyId: party))).Price);

        using var dearer = app.WithServices(_ => { }, new() { ["Signs:FacadeWeekly"] = "70" });
        var (other, _) = await app.HostInAsync();
        var http = dearer.CreateClient();
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", other.Tokens.AccessToken);
        var response = await http.PostAsJsonAsync("/api/hosts/signs", SignKit.Sign(spotId: (await admin.SpotAsync()).Id));
        Assert.Equal(70m, (await response.Content.ReadFromJsonAsync<SignBookingDto>())!.Price);
    }

    [Fact]
    public async Task A_spot_takes_one_sign_a_week_and_is_free_again_after_a_rejection()
    {
        var admin = await app.AdminAsync();
        var (host, _) = await app.HostInAsync();
        var (rival, _) = await app.HostInAsync();
        var spot = await admin.SpotAsync();
        var first = await host.BookedSignAsync(SignKit.Sign(spotId: spot.Id));

        var taken = await rival.BookSignAsync(SignKit.Sign(spotId: spot.Id));
        var nextWeek = await rival.BookSignAsync(SignKit.Sign(spotId: spot.Id, week: SignKit.WeeksOn(DateTime.UtcNow, 1)));
        (await admin.Http.PostAsJsonAsync($"/api/admin/signs/{first.Id}/reject", new { note = "Too dark" })).EnsureSuccessStatusCode();
        var afterRejection = await rival.BookSignAsync(SignKit.Sign(spotId: spot.Id));

        Assert.Equal((HttpStatusCode.Conflict, "spot_taken"), (taken.StatusCode, (await taken.ProblemAsync()).Code));
        Assert.Equal(HttpStatusCode.OK, nextWeek.StatusCode);
        Assert.Equal(HttpStatusCode.OK, afterRejection.StatusCode);
    }

    [Fact]
    public async Task Two_hosts_booking_one_spot_at_once_get_it_once()
    {
        var admin = await app.AdminAsync();
        var spot = await admin.SpotAsync();
        var hosts = new List<Actor>();
        for (var i = 0; i < 6; i++) hosts.Add((await app.HostInAsync()).Host);

        var responses = await Task.WhenAll(hosts.Select(h => h.BookSignAsync(SignKit.Sign(spotId: spot.Id))));

        Assert.Equal(1, responses.Count(r => r.StatusCode == HttpStatusCode.OK));
        Assert.Equal(5, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));
    }

    [Fact]
    public async Task A_venues_own_wall_is_booked_by_that_venue_only()
    {
        var admin = await app.AdminAsync();
        var (host, venue) = await app.HostInAsync();
        var (rival, _) = await app.HostInAsync();
        var wall = await admin.SpotAsync(venueId: venue);

        var byRival = await rival.BookSignAsync(SignKit.Sign(spotId: wall.Id));
        var brand = await admin.Http.PostAsJsonAsync("/api/admin/signs", new
        {
            format = "facade", spotId = wall.Id, text = "VOLT", colorTop = "#ffd23c", colorBottom = "#ff7a18", ink = "#1a0a00", advertiserName = "VOLT",
        });
        var own = await host.BookedSignAsync(SignKit.Sign(spotId: wall.Id, text: "KULA"));

        Assert.Equal(HttpStatusCode.Forbidden, byRival.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, brand.StatusCode); // no paid sign on a venue's building
        await admin.ApproveSignAsync(own.Id);
        var onMap = (await app.CreateClient().MapAsync()).Single(s => s.Id == own.Id);
        Assert.True(onMap.Own);
        Assert.Equal(venue, onMap.Card.VenueId);
    }

    [Fact]
    public async Task A_host_holds_three_signs_at_a_time()
    {
        var admin = await app.AdminAsync();
        var (host, _) = await app.HostInAsync();
        var signs = new List<SignBookingDto>();
        for (var i = 0; i < 3; i++) signs.Add(await host.BookedSignAsync(SignKit.Sign(spotId: (await admin.SpotAsync()).Id)));
        var spare = await admin.SpotAsync();

        var fourth = await host.BookSignAsync(SignKit.Sign(spotId: spare.Id));
        Assert.Equal((HttpStatusCode.Conflict, "sign_limit"), (fourth.StatusCode, (await fourth.ProblemAsync()).Code));

        (await host.Http.DeleteAsync($"/api/hosts/signs/{signs[0].Id}")).EnsureSuccessStatusCode(); // withdrawn: no longer held
        Assert.Equal(HttpStatusCode.OK, (await host.BookSignAsync(SignKit.Sign(spotId: spare.Id))).StatusCode);
    }

    [Fact]
    public async Task An_approved_sign_whose_week_is_over_no_longer_counts_towards_the_three()
    {
        var admin = await app.AdminAsync();
        var (host, _) = await app.HostInAsync();
        for (var i = 0; i < 3; i++) await admin.ApproveSignAsync((await host.BookedSignAsync(SignKit.Sign(spotId: (await admin.SpotAsync()).Id))).Id);

        using var _ = app.Clock.At(DateTime.UtcNow.AddDays(8));

        Assert.Equal(HttpStatusCode.OK, (await host.BookSignAsync(SignKit.Sign(spotId: (await admin.SpotAsync()).Id))).StatusCode);
    }

    [Theory]
    [InlineData("ABCDEFGHIJKLMNOPQRSTUVWX", true)]            // 24
    [InlineData("ABCDEFGHIJKL|MNOPQRSTUVWX", true)]           // 24 on two lines
    [InlineData(" NEON | FRIDAY ", true)]
    [InlineData("ABCDEFGHIJKLMNOPQRSTUVWXY", false)]          // 25
    [InlineData("ONE|TWO|THREE", false)]
    [InlineData("NEON|", false)]
    [InlineData("   ", false)]
    public async Task A_sign_says_up_to_24_characters_on_up_to_two_lines(string text, bool ok)
    {
        var admin = await app.AdminAsync();
        var (host, _) = await app.HostInAsync();

        var response = await host.BookSignAsync(SignKit.Sign(spotId: (await admin.SpotAsync()).Id, text: text));

        if (ok) Assert.Equal(text.Replace(" ", ""), (await response.Content.ReadFromJsonAsync<SignBookingDto>())!.Text);
        else Assert.Equal((HttpStatusCode.BadRequest, "sign_invalid"), (response.StatusCode, (await response.ProblemAsync()).Code));
    }

    [Fact]
    public async Task Colours_are_six_hex_digits()
    {
        var admin = await app.AdminAsync();
        var (host, _) = await app.HostInAsync();
        var spot = await admin.SpotAsync();

        var bad = await host.BookSignAsync(SignKit.Sign(spotId: spot.Id, colorTop: "orange"));
        var upper = await host.BookedSignAsync(SignKit.Sign(spotId: spot.Id, colorTop: "#FF7A18"));

        Assert.Equal((HttpStatusCode.BadRequest, "sign_invalid"), (bad.StatusCode, (await bad.ProblemAsync()).Code));
        Assert.Equal("#ff7a18", upper.ColorTop);
    }

    // ── tonight slots ──

    [Fact]
    public async Task A_tonight_slot_needs_one_of_the_hosts_own_parties()
    {
        var (host, _) = await app.HostInAsync();
        var (other, _) = await app.HostInAsync();
        var theirs = await app.PublishedPartyAsync(other);

        Assert.Equal(HttpStatusCode.BadRequest, (await host.BookSignAsync(SignKit.Sign("tonightSlot"))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await host.BookSignAsync(SignKit.Sign("tonightSlot", partyId: theirs))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await host.BookSignAsync(SignKit.Sign("tonightSlot", partyId: await app.DraftPartyAsync(host)))).StatusCode);
    }

    [Fact]
    public async Task Two_slots_a_night_in_a_city_and_another_night_counts_on_its_own()
    {
        const string city = "kotor"; // no other test books slots here
        var start = DateTime.UtcNow.Date.AddDays(3).AddHours(21); // 22:00 local, three nights on
        var hosts = new List<Actor>();
        for (var i = 0; i < 4; i++) hosts.Add((await app.HostInAsync(city)).Host);
        var (elsewhere, _) = await app.HostInAsync("budva");

        await hosts[0].BookedSignAsync(SignKit.Sign("tonightSlot", partyId: await hosts[0].PartyAtAsync(start)));
        await hosts[1].BookedSignAsync(SignKit.Sign("tonightSlot", partyId: await hosts[1].PartyAtAsync(start.AddHours(1))));
        var third = await hosts[2].BookSignAsync(SignKit.Sign("tonightSlot", partyId: await hosts[2].PartyAtAsync(start.AddHours(2))));
        var nextNight = await hosts[3].BookSignAsync(SignKit.Sign("tonightSlot", partyId: await hosts[3].PartyAtAsync(start.AddDays(1))));
        var otherCity = await elsewhere.BookSignAsync(SignKit.Sign("tonightSlot", partyId: await elsewhere.PartyAtAsync(start)));

        Assert.Equal((HttpStatusCode.Conflict, "slot_full"), (third.StatusCode, (await third.ProblemAsync()).Code));
        Assert.Equal(HttpStatusCode.OK, nextNight.StatusCode);
        Assert.Equal(HttpStatusCode.OK, otherCity.StatusCode);
        var slot = (await nextNight.Content.ReadFromJsonAsync<SignBookingDto>())!;
        Assert.Equal((DateOnly.FromDateTime(start.AddDays(1)), DateOnly.FromDateTime(start.AddDays(1))), (slot.StartsOn, slot.EndsOn));
        Assert.Null(slot.Spot);

        // The options' "free" is tonight's, and three nights on is not tonight.
        using var _ = app.Clock.At(start.AddHours(1));
        Assert.Equal(0, (await hosts[2].SignOptionsAsync()).Formats.Single(f => f.Format == "tonightSlot").Free);
    }

    // ── the map ──

    [Fact]
    public async Task Only_approved_signs_up_today_are_on_the_map_holograms_first()
    {
        var admin = await app.AdminAsync();
        var (host, _) = await app.HostInAsync();
        var (host2, _) = await app.HostInAsync();
        var facade = await host.BookedSignAsync(SignKit.Sign(spotId: (await admin.SpotAsync()).Id, text: "FACADE"));
        var hologram = await host.BookedSignAsync(SignKit.Sign("hologram", (await admin.SpotAsync(format: "hologram")).Id, text: "HOLO"));
        var pending = await host.BookedSignAsync(SignKit.Sign(spotId: (await admin.SpotAsync()).Id, text: "WAITING"));
        var later = await host2.BookedSignAsync(SignKit.Sign(spotId: (await admin.SpotAsync()).Id, week: SignKit.WeeksOn(DateTime.UtcNow, 1)));
        var rejected = await host2.BookedSignAsync(SignKit.Sign(spotId: (await admin.SpotAsync()).Id));
        await admin.ApproveSignAsync(facade.Id);
        await admin.ApproveSignAsync(hologram.Id);
        await admin.ApproveSignAsync(later.Id);
        (await admin.Http.PostAsJsonAsync($"/api/admin/signs/{rejected.Id}/reject", new { note = "No" })).EnsureSuccessStatusCode();

        var mine = (await app.CreateClient().MapAsync()).Where(s => new[] { facade.Id, hologram.Id, pending.Id, later.Id, rejected.Id }.Contains(s.Id)).ToList();

        Assert.Equal([hologram.Id, facade.Id], mine.Select(s => s.Id));
        var sign = mine[1];
        Assert.Equal(("facade", false, "FACADE", "#ec5b93"), (sign.Format, sign.Own, sign.Text, sign.ColorTop));
        Assert.Equal(facade.Spot!.Id, sign.Spot.Id);
        Assert.Equal("FACADE", sign.Card.LogoText);
        Assert.DoesNotContain(await app.CreateClient().MapAsync("budva"), s => s.Id == facade.Id);
        Assert.Equal(HttpStatusCode.BadRequest, (await app.CreateClient().GetAsync("/api/signs?city=atlantis")).StatusCode);
    }

    [Fact]
    public async Task A_sign_tells_its_card_what_to_say()
    {
        var admin = await app.AdminAsync();
        var (host, venue) = await app.HostInAsync();
        var party = await app.PublishedPartyAsync(host);
        var withParty = await host.BookedSignAsync(SignKit.Sign(spotId: (await admin.SpotAsync()).Id, partyId: party, text: "NEON|FRIDAY"));
        var venueOnly = await host.BookedSignAsync(SignKit.Sign(spotId: (await admin.SpotAsync()).Id, text: "VERYLONGNAME"));
        await admin.ApproveSignAsync(withParty.Id);
        await admin.ApproveSignAsync(venueOnly.Id);
        var venueName = await app.WithDb(db => db.VenueProfiles.Where(v => v.Id == venue).Select(v => v.VenueName).SingleAsync());

        var map = await app.CreateClient().MapAsync();

        var partyCard = map.Single(s => s.Id == withParty.Id).Card;
        Assert.Equal(("Neon Friday", "NEON", party, venue, (Guid?)null), (partyCard.Title, partyCard.LogoText, partyCard.PartyId, partyCard.VenueId, partyCard.PerkId));
        Assert.EndsWith($" at {venueName}", partyCard.Subtitle);
        var venueCard = map.Single(s => s.Id == venueOnly.Id);
        Assert.Equal((venueName, $"See what is on at {venueName}.", "VERYLONG", venueName), (venueCard.Card.Title, venueCard.Card.Subtitle, venueCard.Card.LogoText, venueCard.Advertiser));
    }

    private class FixedCosts : ISignPerkCosts
    {
        public Task<IReadOnlyDictionary<Guid, int>> CostsAsync(IReadOnlyCollection<Guid> perkIds, CancellationToken ct) =>
            Task.FromResult<IReadOnlyDictionary<Guid, int>>(perkIds.ToDictionary(id => id, _ => 400));
    }

    [Fact]
    public async Task A_brand_sign_with_a_perk_carries_the_perks_cost_for_the_card()
    {
        var admin = await app.AdminAsync();
        var perk = Guid.NewGuid();
        var spot = await admin.SpotAsync();
        var created = await admin.Http.PostAsJsonAsync("/api/admin/signs", new
        {
            format = "facade", spotId = spot.Id, text = "VOLT", colorTop = "#ffd23c", colorBottom = "#ff7a18", ink = "#1a0a00",
            advertiserName = "VOLT", perkId = perk, cardTitle = "First drink on VOLT", cardSubtitle = "Tonight at Monkey, Flame level and up",
        });
        var id = (await created.Content.ReadFromJsonAsync<SignBookingDto>())!.Id;
        using var withCosts = app.WithServices(s => s.AddScoped<ISignPerkCosts, FixedCosts>());

        var plain = (await app.CreateClient().MapAsync()).Single(s => s.Id == id);
        var priced = (await withCosts.CreateClient().MapAsync()).Single(s => s.Id == id);

        Assert.Equal(("VOLT", false, "First drink on VOLT", "Tonight at Monkey, Flame level and up", "VOLT", perk),
            (plain.Advertiser, plain.Own, plain.Card.Title, plain.Card.Subtitle, plain.Card.LogoText, plain.Card.PerkId!.Value));
        Assert.Null(plain.Card.GlowCost);
        Assert.Equal(400, priced.Card.GlowCost);
    }

    [Fact]
    public async Task A_hidden_sign_is_gone_for_that_viewer_only()
    {
        var admin = await app.AdminAsync();
        var (host, _) = await app.HostInAsync();
        var sign = await host.BookedSignAsync(SignKit.Sign(spotId: (await admin.SpotAsync()).Id));
        await admin.ApproveSignAsync(sign.Id);
        var (vule, mila) = (await app.UserAsync(), await app.UserAsync());

        Assert.Equal(HttpStatusCode.NoContent, (await vule.Http.PostAsync($"/api/signs/{sign.Id}/hide", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await vule.Http.PostAsync($"/api/signs/{sign.Id}/hide", null)).StatusCode);

        Assert.DoesNotContain(await vule.Http.MapAsync(), s => s.Id == sign.Id);
        Assert.Contains(await mila.Http.MapAsync(), s => s.Id == sign.Id);
        Assert.Contains(await app.CreateClient().MapAsync(), s => s.Id == sign.Id);
        Assert.Equal(HttpStatusCode.NotFound, (await vule.Http.PostAsync($"/api/signs/{Guid.NewGuid()}/hide", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await app.CreateClient().PostAsync($"/api/signs/{sign.Id}/hide", null)).StatusCode);
    }

    // ── the sponsored party ──

    [Fact]
    public async Task A_party_with_an_approved_slot_is_sponsored_tonight_and_not_tomorrow()
    {
        var admin = await app.AdminAsync();
        var (host, _) = await app.HostInAsync();
        var startsAt = DateTime.UtcNow.AddHours(2);
        var party = await host.PartyAtAsync(startsAt, hours: 40);
        var other = await host.PartyAtAsync(startsAt);
        var slot = await host.BookedSignAsync(SignKit.Sign("tonightSlot", partyId: party));
        var (lat, lng) = await app.WithDb(async db => { var p = await db.Parties.SingleAsync(x => x.Id == party); return (p.Latitude, p.Longitude); });
        var near = string.Create(CultureInfo.InvariantCulture, $"lat={lat}&lng={lng}&radiusKm=1");

        async Task<bool?> Sponsored(string path)
        {
            var json = await app.CreateClient().GetFromJsonAsync<JsonElement>(path);
            if (json.ValueKind == JsonValueKind.Array) json = json.EnumerateArray().Single(p => p.GetProperty("id").GetGuid() == party);
            return json.TryGetProperty("sponsored", out var s) ? s.GetBoolean() : null;
        }

        Assert.Null(await Sponsored($"/api/parties/{party}")); // waiting for review
        await admin.ApproveSignAsync(slot.Id);
        Assert.True(await Sponsored($"/api/parties/{party}"));
        Assert.True(await Sponsored($"/api/parties?{near}"));
        Assert.False((await app.CreateClient().GetFromJsonAsync<JsonElement>($"/api/parties/{other}")).TryGetProperty("sponsored", out _));

        using var tomorrow = app.Clock.At(startsAt.AddDays(1));
        Assert.Null(await Sponsored($"/api/parties/{party}"));
    }

    // ── artwork, cancelling, who may ──

    [Fact]
    public async Task Artwork_uploads_when_storage_is_on_and_says_storage_off_when_it_is_not()
    {
        var (host, _) = await app.HostInAsync();
        byte[] png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13, 1, 2, 3];
        MultipartFormDataContent Form()
        {
            var form = new MultipartFormDataContent();
            form.Add(new ByteArrayContent(png), "file", "sign.png");
            return form;
        }

        var on = await host.Http.PostAsync("/api/hosts/signs/artwork", Form());
        app.Images.IsConfigured = false;
        HttpResponseMessage off;
        try { off = await host.Http.PostAsync("/api/hosts/signs/artwork", Form()); }
        finally { app.Images.IsConfigured = true; }

        Assert.Equal(HttpStatusCode.OK, on.StatusCode);
        Assert.StartsWith("https://images.test/signs/", (await on.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("artworkUrl").GetString());
        Assert.Equal((HttpStatusCode.ServiceUnavailable, "storage_off"), (off.StatusCode, (await off.ProblemAsync()).Code));
    }

    [Fact]
    public async Task A_sign_can_be_withdrawn_until_it_is_up()
    {
        var admin = await app.AdminAsync();
        var (host, _) = await app.HostInAsync();
        var waiting = await host.BookedSignAsync(SignKit.Sign(spotId: (await admin.SpotAsync()).Id));
        var running = await host.BookedSignAsync(SignKit.Sign(spotId: (await admin.SpotAsync()).Id));
        var later = await host.BookedSignAsync(SignKit.Sign(spotId: (await admin.SpotAsync()).Id, week: SignKit.WeeksOn(DateTime.UtcNow, 1)));
        await admin.ApproveSignAsync(running.Id);
        await admin.ApproveSignAsync(later.Id);
        var (rival, _) = await app.HostInAsync();

        Assert.Equal(HttpStatusCode.NotFound, (await rival.Http.DeleteAsync($"/api/hosts/signs/{waiting.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await host.Http.DeleteAsync($"/api/hosts/signs/{waiting.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await host.Http.DeleteAsync($"/api/hosts/signs/{later.Id}")).StatusCode);
        var up = await host.Http.DeleteAsync($"/api/hosts/signs/{running.Id}");
        Assert.Equal((HttpStatusCode.Conflict, "sign_running"), (up.StatusCode, (await up.ProblemAsync()).Code));
        var mine = (await host.SignOptionsAsync()).Mine.ToDictionary(m => m.Id, m => m.Status);
        Assert.Equal(("cancelled", "cancelled", "approved"), (mine[waiting.Id], mine[later.Id], mine[running.Id]));
        Assert.True((await rival.BookSignAsync(SignKit.Sign(spotId: waiting.Spot!.Id))).IsSuccessStatusCode); // the spot is free again
    }

    [Fact]
    public async Task Booking_signs_is_for_hosts()
    {
        var guest = await app.UserAsync();

        Assert.Equal(HttpStatusCode.Forbidden, (await guest.Http.GetAsync("/api/hosts/signs/options")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await guest.BookSignAsync(SignKit.Sign())).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await app.CreateClient().GetAsync("/api/signs?city=podgorica")).StatusCode);
    }

    [Fact]
    public async Task Deleting_an_account_cancels_its_signs_and_forgets_its_hides()
    {
        var admin = await app.AdminAsync();
        var (host, _) = await app.HostInAsync();
        var sign = await host.BookedSignAsync(SignKit.Sign(spotId: (await admin.SpotAsync()).Id));
        await admin.ApproveSignAsync(sign.Id);
        var viewer = await app.UserAsync();
        (await viewer.Http.PostAsync($"/api/signs/{sign.Id}/hide", null)).EnsureSuccessStatusCode();

        (await host.Http.DeleteAsync("/api/auth/account")).EnsureSuccessStatusCode();
        (await viewer.Http.DeleteAsync("/api/auth/account")).EnsureSuccessStatusCode();

        var (status, hides) = await app.WithDb(async db => (
            await db.Set<SignBooking>().Where(b => b.Id == sign.Id).Select(b => b.Status).SingleAsync(),
            await db.Set<SignHide>().CountAsync(h => h.UserId == viewer.Id)));
        Assert.Equal(("cancelled", 0), (status, hides));
        Assert.DoesNotContain(await app.CreateClient().MapAsync(), s => s.Id == sign.Id);
    }

    // ── the demo ──

    [Fact]
    public async Task The_demo_city_has_its_signs_up_a_free_spot_or_three_and_one_waiting_for_review()
    {
        var settings = new Dictionary<string, string?>
        {
            ["ConnectionStrings:DefaultConnection"] = app.ConnectionStringFor("signs_" + Guid.NewGuid().ToString("N")[..10]),
            ["Seed:Demo"] = "true",
            ["Seed:OwnerEmail"] = $"owner-{Guid.NewGuid():N}@example.test",
        };
        var email = settings["Seed:OwnerEmail"]!;
        using (var first = app.With(settings))
            (await first.CreateClient().PostAsJsonAsync("/api/auth/register",
                new { userName = "owner" + Guid.NewGuid().ToString("N")[..8], email, password = Actor.DefaultPassword })).EnsureSuccessStatusCode();
        using var seeded = app.With(settings); // the owner now runs Monkey and is the admin
        var login = await seeded.CreateClient().PostAsJsonAsync("/api/auth/login", new { email, password = Actor.DefaultPassword });
        var owner = seeded.CreateClient();
        owner.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer",
            (await login.Content.ReadFromJsonAsync<FindMyParty.Api.Identity.LoginResponse>())!.AccessToken);

        var map = await seeded.CreateClient().MapAsync();
        var options = (await owner.GetFromJsonAsync<SignOptions>("/api/hosts/signs/options"))!;
        var queue = (await owner.GetFromJsonAsync<List<AdminSignDto>>("/api/admin/signs"))!;
        var parties = await seeded.CreateClient().GetFromJsonAsync<List<JsonElement>>("/api/parties?pageSize=100");

        Assert.Equal("AURA|SPRITZ", map[0].Text); // holograms first
        Assert.Equal(new HashSet<string> { "AURA|SPRITZ", "VOLT", "KULA", "DEEP|CUTS", "BALKAN|BASS" }, map.Select(s => s.Text).ToHashSet());
        Assert.Equal(5, map.Count);
        var volt = map.Single(s => s.Text == "VOLT");
        Assert.Equal(("First drink on VOLT", "Tonight at Monkey, Flame level and up", "#ffd23c", "#ff7a18", "#1a0a00", 5, false),
            (volt.Card.Title, volt.Card.Subtitle, volt.ColorTop, volt.ColorBottom, volt.Ink, volt.Spot.Number, volt.Own));
        Assert.Equal(DemoContext.Id("perk:volt"), volt.Card.PerkId);
        Assert.True(map.Single(s => s.Text == "KULA").Own);
        Assert.Equal("hologram", map[0].Format);
        var facade = options.Formats.Single(f => f.Format == "facade");
        var hologram = options.Formats.Single(f => f.Format == "hologram");
        Assert.Equal((7, 3, 2, 1), (facade.Total, facade.Free, hologram.Total, hologram.Free)); // Kula's own wall is not offered to Monkey
        Assert.Equal([3, 6, 8], options.Spots.Where(s => s is { Format: "facade", Free: true }).Select(s => s.Number));
        Assert.Equal(("Njegoševa", "Stara Varoš", 202d), options.Spots.Where(s => s is { Format: "facade", Number: 3 }).Select(s => (s.Label, s.Area, s.BearingDeg)).Single());
        Assert.Equal("NEON|FRIDAY", Assert.Single(queue).Text);
        Assert.Contains(options.Mine, m => m.Text == "NEON|FRIDAY" && m.Status == "pendingReview");
        var atlas = parties!.Single(p => p.GetProperty("venueName").GetString() == "Atlas" && p.GetProperty("startsAt").GetDateTime() <= DateTime.UtcNow);
        Assert.True(atlas.GetProperty("sponsored").GetBoolean());

        // Again, as every half hour: nothing doubles.
        using var scope = seeded.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<FindMyParty.Api.Data.AppDbContext>();
        var before = (await db.Set<SignSpot>().CountAsync(), await db.Set<SignBooking>().CountAsync());
        await scope.ServiceProvider.GetRequiredService<FindMyParty.Api.Demo.DemoSeeder>().EnsureAsync(email);
        Assert.Equal(before, (await db.Set<SignSpot>().CountAsync(), await db.Set<SignBooking>().CountAsync()));
    }
}
