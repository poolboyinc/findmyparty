using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using FindMyParty.Api.Demo;
using FindMyParty.Api.Glow;
using FindMyParty.Api.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace FindMyParty.Api.Tests;

/// <summary>The night recap (S-16), its share link and page, the next-day push, and the demo owner's history.</summary>
[Collection("api")]
public class RecapTests(TestApp app)
{
    private static readonly DateOnly Friday = new(2026, 11, 13);

    private Task<NightRecap?> RecapAsync(Actor guest, DateOnly night) =>
        guest.Http.GetFromJsonAsync<NightRecap>($"/api/me/nights/{night:yyyy-MM-dd}");

    [Fact]
    public async Task One_venue_is_one_good_night_from_the_scan_to_the_end_of_its_party()
    {
        var venue = await app.VenueAsync();
        var guest = await app.UserAsync();
        await app.ScanAsync(guest.Id, venue, GlowKit.Local(2026, 11, 13, 23, 0), "Techno", endsAt: GlowKit.Local(2026, 11, 14, 4, 0));

        var recap = (await RecapAsync(guest, Friday))!;

        Assert.Equal(("One venue.\nOne good night.", 300, "Techno", 175), (recap.Headline, recap.MinutesOut, recap.MostlyGenre, recap.Glow));
        Assert.Equal((Friday, "Podgorica", "Spark", (string?)null), (recap.Date, recap.CityName, recap.LevelName, recap.ShareUrl));
        Assert.Equal((await app.UserNameAsync(guest.Id)).ToLowerInvariant(), recap.Handle);
        Assert.Equal([venue.Id], recap.Venues.Select(v => v.Id));
        Assert.Equal(HttpStatusCode.NotFound, (await guest.Http.GetAsync("/api/me/nights/2026-11-12")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await guest.Http.GetAsync("/api/me/nights/13-11-2026")).StatusCode);
    }

    [Fact]
    public async Task Two_venues_are_one_long_night_in_the_order_visited_and_a_tie_in_genre_goes_to_the_first()
    {
        var (monkey, kula) = (await app.VenueAsync(), await app.VenueAsync());
        var guest = await app.UserAsync();
        await app.ScanAsync(guest.Id, monkey, GlowKit.Local(2026, 11, 13, 23, 47), "Techno", endsAt: GlowKit.Local(2026, 11, 14, 4, 0));
        await app.ScanAsync(guest.Id, kula, GlowKit.Local(2026, 11, 14, 1, 30), "House", endsAt: GlowKit.Local(2026, 11, 14, 3, 0));

        var recap = (await RecapAsync(guest, Friday))!;

        Assert.Equal("Two venues.\nOne long night.", recap.Headline);
        Assert.Equal([monkey.Id, kula.Id], recap.Venues.Select(v => v.Id));
        Assert.Equal(193, recap.MinutesOut); // 23:47 to 03:00, when the last party scanned into ends
        Assert.Equal(("Techno", 175 + 150), (recap.MostlyGenre, recap.Glow));
    }

    [Fact]
    public async Task Three_venues_are_one_big_night_and_the_genre_of_most_parties_wins()
    {
        var venues = new[] { await app.VenueAsync(), await app.VenueAsync(), await app.VenueAsync() };
        var guest = await app.UserAsync();
        await app.ScanAsync(guest.Id, venues[0], GlowKit.Local(2026, 11, 13, 22, 0), "Techno");
        await app.ScanAsync(guest.Id, venues[1], GlowKit.Local(2026, 11, 14, 0, 0), "House");
        await app.ScanAsync(guest.Id, venues[2], GlowKit.Local(2026, 11, 14, 2, 0), "House");

        var recap = (await RecapAsync(guest, Friday))!;

        Assert.Equal(("Three venues.\nOne big night.", "House", 3), (recap.Headline, recap.MostlyGenre, recap.Venues.Count));
    }

    [Fact]
    public async Task Time_out_stops_at_six_in_the_morning()
    {
        var venue = await app.VenueAsync();
        var guest = await app.UserAsync();
        await app.ScanAsync(guest.Id, venue, GlowKit.Local(2026, 11, 13, 23, 0), endsAt: GlowKit.Local(2026, 11, 14, 8, 0));

        Assert.Equal(7 * 60, (await RecapAsync(guest, Friday))!.MinutesOut);
    }

    [Fact]
    public async Task Nights_are_listed_newest_first_with_their_venues_and_glow()
    {
        var (a, b) = (await app.VenueAsync(), await app.VenueAsync());
        var guest = await app.UserAsync();
        await app.ScanAsync(guest.Id, a, GlowKit.Local(2026, 11, 6, 23, 0));
        await app.ScanAsync(guest.Id, a, GlowKit.Local(2026, 11, 13, 23, 0));
        await app.ScanAsync(guest.Id, b, GlowKit.Local(2026, 11, 14, 1, 0));

        var nights = (await guest.Http.GetFromJsonAsync<List<NightSummary>>("/api/me/nights"))!;

        Assert.Equal([Friday, new DateOnly(2026, 11, 6)], nights.Select(n => n.Date));
        Assert.Equal((2, "Podgorica", 150 + 150), (nights[0].VenueCount, nights[0].CityName, nights[0].Glow));
        Assert.Single((await guest.Http.GetFromJsonAsync<List<NightSummary>>("/api/me/nights?take=1"))!);
    }

    // ── sharing ──

    [Fact]
    public async Task A_shared_recap_shows_the_card_to_anyone_with_the_link_and_no_times_until_it_is_taken_back()
    {
        var (monkey, kula) = (await app.VenueAsync(), await app.VenueAsync());
        var guest = await app.UserAsync();
        await app.ScanAsync(guest.Id, monkey, GlowKit.Local(2026, 11, 13, 23, 47));
        await app.ScanAsync(guest.Id, kula, GlowKit.Local(2026, 11, 14, 1, 30));
        Assert.Equal(HttpStatusCode.NotFound, (await guest.Http.PostAsync("/api/me/nights/2026-11-12/share", null)).StatusCode);

        var shared = await guest.Http.PostAsync("/api/me/nights/2026-11-13/share", null);
        var url = (await shared.Content.ReadFromJsonAsync<ShareUrlResponse>())!.ShareUrl;
        var again = (await (await guest.Http.PostAsync("/api/me/nights/2026-11-13/share", null)).Content.ReadFromJsonAsync<ShareUrlResponse>())!.ShareUrl;
        var token = url[(url.LastIndexOf('/') + 1)..];

        Assert.Equal(HttpStatusCode.OK, shared.StatusCode);
        Assert.Contains("/r/", url);
        Assert.Equal(16, token.Length);
        Assert.Equal(url, again);
        Assert.Equal(url, (await RecapAsync(guest, Friday))!.ShareUrl);

        var anonymous = app.CreateClient();
        var json = await anonymous.GetFromJsonAsync<JsonElement>($"/api/recaps/{token}");
        Assert.Equal(
            ["cityName", "date", "glow", "handle", "headline", "levelName", "minutesOut", "mostlyGenre", "shareUrl", "venues"],
            json.EnumerateObject().Select(p => p.Name).Order());
        Assert.All(json.GetProperty("venues").EnumerateArray(), v =>
            Assert.Equal(["id", "latitude", "longitude", "name"], v.EnumerateObject().Select(p => p.Name).Order()));
        Assert.Equal(2, json.GetProperty("venues").GetArrayLength());
        Assert.Equal(url, json.GetProperty("shareUrl").GetString());

        Assert.Equal(HttpStatusCode.NoContent, (await guest.Http.DeleteAsync("/api/me/nights/2026-11-13/share")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync($"/api/recaps/{token}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync($"/r/{token}")).StatusCode);
        Assert.Null((await RecapAsync(guest, Friday))!.ShareUrl);
    }

    [Fact]
    public async Task The_recap_page_carries_the_preview_tags_and_opens_the_recap_in_the_app()
    {
        var (monkey, kula) = (await app.VenueAsync(), await app.VenueAsync());
        var guest = await app.UserAsync();
        await app.ScanAsync(guest.Id, monkey, GlowKit.Local(2026, 11, 13, 23, 47));
        await app.ScanAsync(guest.Id, kula, GlowKit.Local(2026, 11, 14, 1, 30));
        var url = (await (await guest.Http.PostAsync("/api/me/nights/2026-11-13/share", null)).Content.ReadFromJsonAsync<ShareUrlResponse>())!.ShareUrl;
        var token = url[(url.LastIndexOf('/') + 1)..];

        var page = await app.CreateClient().GetAsync($"/r/{token}");
        var html = WebUtility.HtmlDecode(await page.Content.ReadAsStringAsync());

        Assert.Equal(HttpStatusCode.OK, page.StatusCode);
        Assert.Equal("text/html", page.Content.Headers.ContentType!.MediaType);
        var handle = (await app.UserNameAsync(guest.Id)).ToLowerInvariant();
        Assert.Contains($"<meta property=\"og:title\" content=\"@{handle}'s night\">", html);
        Assert.Contains("<meta property=\"og:description\" content=\"Two venues. One long night. +325 Glow\">", html);
        Assert.Contains("/og.png\">", html);
        Assert.Contains($"findmypartymobileapp://recap/{token}", html);
        Assert.DoesNotContain(guest.Id.ToString(), html);
        Assert.DoesNotContain("23:47", html);

        Assert.Equal(HttpStatusCode.NotFound, (await app.CreateClient().GetAsync("/r/nope")).StatusCode);
    }

    // ── the next-day push ──

    [Fact]
    public async Task Your_night_is_pushed_once_at_noon_the_day_after()
    {
        var (a, b) = (await app.VenueAsync(), await app.VenueAsync());
        var guest = await app.UserAsync();
        await app.ScanAsync(guest.Id, a, GlowKit.Local(2026, 11, 13, 23, 0));
        await app.ScanAsync(guest.Id, b, GlowKit.Local(2026, 11, 14, 1, 0));
        var pusher = app.Services.GetRequiredService<RecapPusher>();

        using (app.Clock.At(GlowKit.Local(2026, 11, 14, 11, 59))) await pusher.RunOnceAsync();
        Assert.Empty(app.Notifier.SentTo(guest.Id, "recap_ready"));

        using (app.Clock.At(GlowKit.Local(2026, 11, 14, 12, 0))) await pusher.RunOnceAsync();
        using (app.Clock.At(GlowKit.Local(2026, 11, 14, 12, 15))) await pusher.RunOnceAsync();

        var push = Assert.Single(app.Notifier.SentTo(guest.Id, "recap_ready"));
        Assert.Equal(("Your night", "Two venues, +325 Glow", NotifyCategory.Nights), (push.Title, push.Body, push.Category));
        Assert.Equal(Friday, Assert.IsType<RecapPushData>(push.Data).Date);
    }

    // ── the demo owner ──

    [Fact]
    public async Task The_demo_owner_gets_flame_a_three_week_streak_a_two_venue_last_friday_and_volt_to_claim()
    {
        var database = "glow_" + Guid.NewGuid().ToString("N")[..10];
        var email = $"owner-{Guid.NewGuid():N}@example.test";
        WebApplicationFactory<Program> Seeded() => app.With(new()
        {
            ["ConnectionStrings:DefaultConnection"] = app.ConnectionStringFor(database),
            ["Seed:Demo"] = "true",
            ["Seed:OwnerEmail"] = email,
        });
        using (var first = Seeded())
            (await first.CreateClient().PostAsJsonAsync("/api/auth/register",
                new { userName = "owner" + Guid.NewGuid().ToString("N")[..8], email, password = Actor.DefaultPassword })).EnsureSuccessStatusCode();

        using var seeded = Seeded();
        var http = seeded.CreateClient();
        var login = await (await http.PostAsJsonAsync("/api/auth/login", new { email, password = Actor.DefaultPassword })).Content.ReadFromJsonAsync<LoginResponse>();
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", login!.AccessToken);

        var glow = (await http.GetFromJsonAsync<GlowSummary>("/api/me/glow"))!;
        Assert.Equal(("Flame", 1250, 3, 6, 4), (glow.Level.Name, glow.Lifetime, glow.StreakWeeks, glow.NightsOut, glow.VenuesLit));
        var nights = (await http.GetFromJsonAsync<List<NightSummary>>("/api/me/nights"))!;
        var lastFriday = nights.First(n => n.Date.DayOfWeek == DayOfWeek.Friday);
        var recap = (await http.GetFromJsonAsync<NightRecap>($"/api/me/nights/{lastFriday.Date:yyyy-MM-dd}"))!;
        Assert.Equal(("Two venues.\nOne long night.", "Monkey, Kula"), (recap.Headline, string.Join(", ", recap.Venues.Select(v => v.Name))));

        var perks = (await http.GetFromJsonAsync<List<PerkItem>>("/api/me/perks?city=podgorica"))!;
        Assert.Equal(
            ["freeEntryBefore held Free entry before midnight Monkey, Kula, Blok 5, Flame level", "First drink on VOLT claimable", "skipLine locked", "plusOneFree locked"],
            perks.Select(p => p.Sponsored ? $"{p.Title} {p.State}" : p.State == "held" ? $"{p.Id} {p.State} {p.Title} {p.Subtitle}" : $"{p.Id} {p.State}"));
        Assert.Equal("Tonight at Monkey, 400 Glow", perks.Single(p => p.Sponsored).Subtitle);

        // Every demo scan has its Glow, and a second round adds nothing.
        using var scope = seeded.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await db.CheckIns.AnyAsync(c => !db.Set<GlowEntry>().Any(e => e.BookingId == c.BookingId && e.UserId == c.GuestUserId && e.Kind == GlowKinds.Scan)));
        var before = (await db.Set<GlowEntry>().CountAsync(), await db.Bookings.CountAsync(), await db.Parties.CountAsync(), await db.Set<SponsoredPerk>().CountAsync());
        await scope.ServiceProvider.GetRequiredService<DemoSeeder>().EnsureAsync(email);
        Assert.Equal(before, (await db.Set<GlowEntry>().CountAsync(), await db.Bookings.CountAsync(), await db.Parties.CountAsync(), await db.Set<SponsoredPerk>().CountAsync()));
    }
}
