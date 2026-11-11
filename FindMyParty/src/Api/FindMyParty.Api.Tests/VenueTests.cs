using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using FindMyParty.Api.Bookings;
using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using FindMyParty.Api.Parties;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace FindMyParty.Api.Tests;

[Collection("api")]
public class VenueTests(TestApp app)
{
    // ── what a venue says about itself ──

    [Fact]
    public async Task A_venue_carries_its_city_kind_area_and_next_party_in_the_list_and_on_its_page()
    {
        var at = await app.HostAloneAsync(kind: "Club", area: "Stara Varoš");
        var starts = DateTime.UtcNow.AddHours(3);
        var acts = new[] { new { name = "Lena K", role = "DJ", startsAt = starts }, new { name = "DJ Proximus", role = "DJ", startsAt = starts.AddHours(2) } };
        var party = await PublishedAsync(at, VenueTestHelpers.PartyInput(at, starts, starts.AddHours(5), price: 5, acts: acts));

        var row = Assert.Single((await app.CreateClient().GetFromJsonAsync<JsonElement>($"/api/venues?{at.Near}")).EnumerateArray());
        var page = await app.CreateClient().GetFromJsonAsync<JsonElement>($"/api/venues/{at.VenueId}");

        Assert.Equal(("podgorica", "Club", "Stara Varoš"), (row.GetProperty("city").GetString(), row.GetProperty("kind").GetString(), row.GetProperty("area").GetString()));
        Assert.Equal(party, row.GetProperty("partyId").GetGuid());
        Assert.Equal("Techno", row.GetProperty("partyGenre").GetString());
        Assert.Equal(5m, row.GetProperty("partyPrice").GetDecimal());
        Assert.Equal("Lena K, DJ Proximus", row.GetProperty("partyLineupText").GetString());
        Assert.Equal(JsonValueKind.String, row.GetProperty("partyStartsAt").ValueKind);
        Assert.Equal(JsonValueKind.String, row.GetProperty("partyEndsAt").ValueKind);
        Assert.Equal(JsonValueKind.Null, row.GetProperty("footprint").ValueKind);

        Assert.Equal(("podgorica", "Club", "Stara Varoš"), (page.GetProperty("city").GetString(), page.GetProperty("kind").GetString(), page.GetProperty("area").GetString()));
        Assert.Equal(JsonValueKind.Null, page.GetProperty("imageUrl").ValueKind);
        Assert.False(page.GetProperty("following").GetBoolean());
        Assert.Equal("Lena K, DJ Proximus", Assert.Single(page.GetProperty("parties").EnumerateArray()).GetProperty("lineupText").GetString());
    }

    [Fact]
    public async Task The_venue_list_filters_by_city_and_refuses_a_city_it_does_not_know()
    {
        var budva = await app.HostAloneAsync(city: "budva");
        var near = string.Create(CultureInfo.InvariantCulture, $"lat={budva.Latitude}&lng={budva.Longitude}&radiusKm=1");

        var inBudva = await app.CreateClient().GetFromJsonAsync<JsonElement>($"/api/venues?city=budva&{near}");
        var inKotor = await app.CreateClient().GetFromJsonAsync<JsonElement>($"/api/venues?city=kotor&{near}");
        var unknown = await app.CreateClient().GetAsync("/api/venues?city=atlantis");

        Assert.Equal(budva.VenueId, Assert.Single(inBudva.EnumerateArray()).GetProperty("id").GetGuid());
        Assert.Empty(inKotor.EnumerateArray());
        await AssertProblem(unknown, HttpStatusCode.BadRequest, "city_unknown");
    }

    [Fact]
    public async Task A_venue_page_runs_the_party_enrichers_over_its_parties()
    {
        var at = await app.HostAloneAsync();
        await PublishedAsync(at, VenueTestHelpers.PartyInput(at, DateTime.UtcNow.AddHours(3), DateTime.UtcNow.AddHours(8)));
        using var stamped = app.WithServices(s => s.AddScoped<IPartyEnricher, PartyStamp>());

        var page = await stamped.CreateClient().GetFromJsonAsync<JsonElement>($"/api/venues/{at.VenueId}");

        Assert.True(Assert.Single(page.GetProperty("parties").EnumerateArray()).GetProperty("stamp").GetBoolean());
    }

    private class PartyStamp : IPartyEnricher
    {
        public Task EnrichAsync(IReadOnlyList<PartyResponse> parties, Guid? viewerId, CancellationToken ct)
        {
            foreach (var p in parties) p.Extra["stamp"] = true;
            return Task.CompletedTask;
        }
    }

    // ── footprint ──

    private static object Ring(int points)
    {
        var ring = Enumerable.Range(0, points).Select(i => new[] { 19.26 + i * 0.0001, 42.44 + (i % 2) * 0.0001 }).ToArray();
        return new { ring, heightM = 18.5 };
    }

    [Fact]
    public async Task The_venues_host_and_an_admin_may_draw_its_building_and_another_host_may_not()
    {
        var at = await app.HostAloneAsync();
        var admin = await app.AdminAsync();
        var other = await app.HostAsync();

        var byHost = await at.Host.Http.PutAsJsonAsync($"/api/venues/{at.VenueId}/footprint", Ring(5));
        var byOther = await other.Http.PutAsJsonAsync($"/api/venues/{at.VenueId}/footprint", Ring(6));
        var byAdmin = await admin.Http.PutAsJsonAsync($"/api/venues/{at.VenueId}/footprint", Ring(4));
        var signedOut = await app.CreateClient().PutAsJsonAsync($"/api/venues/{at.VenueId}/footprint", Ring(4));

        Assert.Equal(HttpStatusCode.NoContent, byHost.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, byOther.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, byAdmin.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, signedOut.StatusCode);

        var footprint = (await app.CreateClient().GetFromJsonAsync<JsonElement>($"/api/venues/{at.VenueId}")).GetProperty("footprint");
        var row = Assert.Single((await app.CreateClient().GetFromJsonAsync<JsonElement>($"/api/venues?{at.Near}")).EnumerateArray());
        Assert.Equal(4, footprint.GetProperty("ring").GetArrayLength());
        Assert.Equal(19.2601, footprint.GetProperty("ring")[1][0].GetDouble());
        Assert.Equal(42.4401, footprint.GetProperty("ring")[1][1].GetDouble());
        Assert.Equal(18.5, footprint.GetProperty("heightM").GetDouble());
        Assert.Equal(4, row.GetProperty("footprint").GetProperty("ring").GetArrayLength());
    }

    [Theory]
    [InlineData(3)]
    [InlineData(201)]
    public async Task A_footprint_has_four_to_two_hundred_points(int points)
    {
        var at = await app.HostAloneAsync();

        var response = await at.Host.Http.PutAsJsonAsync($"/api/venues/{at.VenueId}/footprint", Ring(points));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task A_footprint_for_a_venue_that_does_not_exist_is_not_found()
    {
        var response = await (await app.AdminAsync()).Http.PutAsJsonAsync($"/api/venues/{Guid.NewGuid()}/footprint", Ring(4));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ── the host's own venue ──

    [Fact]
    public async Task A_host_sets_kind_and_area_and_reads_them_back_with_city_image_and_followers()
    {
        var at = await app.HostAloneAsync();

        var edit = await at.Host.Http.PatchAsJsonAsync("/api/hosts/profile", new { venueName = "Monkey", kind = "Club", area = "Stara Varoš", workingDays = "Thu,Fri,Sat" });
        var profile = await at.Host.Http.GetFromJsonAsync<JsonElement>("/api/hosts/profile");

        Assert.Equal(HttpStatusCode.NoContent, edit.StatusCode);
        Assert.Equal(at.VenueId.ToString(), profile.GetProperty("venueId").GetString());
        Assert.Equal(("Monkey", "Club", "Stara Varoš", "podgorica"),
            (profile.GetProperty("venueName").GetString(), profile.GetProperty("kind").GetString(), profile.GetProperty("area").GetString(), profile.GetProperty("city").GetString()));
        Assert.Equal(JsonValueKind.Null, profile.GetProperty("imageUrl").ValueKind);
        Assert.Equal(0, profile.GetProperty("followerCount").GetInt32());
    }

    [Fact]
    public async Task Leaving_kind_and_area_out_of_an_edit_keeps_them()
    {
        var at = await app.HostAloneAsync(kind: "Bar", area: "Centar");

        await at.Host.Http.PatchAsJsonAsync("/api/hosts/profile", new { venueName = "Dr. House" });
        var profile = await at.Host.Http.GetFromJsonAsync<JsonElement>("/api/hosts/profile");

        Assert.Equal(("Bar", "Centar"), (profile.GetProperty("kind").GetString(), profile.GetProperty("area").GetString()));
    }

    [Fact]
    public async Task An_admin_onboards_a_host_into_the_nearest_city_unless_told_which()
    {
        var admin = await app.AdminAsync();
        var nearBudva = await app.UserAsync();
        var inKotor = await app.UserAsync();
        var nowhere = await app.UserAsync();

        var first = await admin.Http.PostAsJsonAsync($"/api/hosts/{nearBudva.Id}", new { venueName = "Top Hill", address = "Topliški put", latitude = 42.2950, longitude = 18.8450, kind = "Club", area = "Topliški put" });
        var second = await admin.Http.PostAsJsonAsync($"/api/hosts/{inKotor.Id}", new { venueName = "Maximus", address = "Stari grad", latitude = 42.44, longitude = 19.26, city = "kotor" });
        var third = await admin.Http.PostAsJsonAsync($"/api/hosts/{nowhere.Id}", new { venueName = "X", address = "Y", latitude = 42.44, longitude = 19.26, city = "atlantis" });

        Assert.Equal(HttpStatusCode.NoContent, first.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, second.StatusCode);
        await AssertProblem(third, HttpStatusCode.BadRequest, "city_unknown");
        var budva = await (await app.LoginAsync(nearBudva.Email)).Http.GetFromJsonAsync<JsonElement>("/api/hosts/profile");
        var kotor = await (await app.LoginAsync(inKotor.Email)).Http.GetFromJsonAsync<JsonElement>("/api/hosts/profile");
        Assert.Equal(("budva", "Club", "Topliški put"), (budva.GetProperty("city").GetString(), budva.GetProperty("kind").GetString(), budva.GetProperty("area").GetString()));
        Assert.Equal("kotor", kotor.GetProperty("city").GetString());

        var moved = await admin.Http.PutAsJsonAsync($"/api/hosts/{inKotor.Id}/profile", new { venueName = "Maximus", address = "Hercegovačka 1", latitude = 42.4411, longitude = 19.2636 });
        Assert.Equal(HttpStatusCode.NoContent, moved.StatusCode);
        Assert.Equal("podgorica", (await (await app.LoginAsync(inKotor.Email)).Http.GetFromJsonAsync<JsonElement>("/api/hosts/profile")).GetProperty("city").GetString());
    }

    // ── venue image ──

    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1];

    private static MultipartFormDataContent Upload(byte[] bytes)
    {
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        return new MultipartFormDataContent { { file, "file", "upload.jpg" } };
    }

    [Fact]
    public async Task A_host_uploads_the_venue_image_and_it_shows_on_the_venue_page()
    {
        var at = await app.HostAloneAsync();

        var response = await at.Host.Http.PostAsync("/api/hosts/profile/image", Upload(Png));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var imageUrl = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("imageUrl").GetString();
        Assert.StartsWith($"https://images.test/venues/{at.VenueId}/", imageUrl);
        Assert.EndsWith(".png", imageUrl);
        Assert.Equal(imageUrl, (await app.CreateClient().GetFromJsonAsync<JsonElement>($"/api/venues/{at.VenueId}")).GetProperty("imageUrl").GetString());
        Assert.Equal(imageUrl, (await at.Host.Http.GetFromJsonAsync<JsonElement>("/api/hosts/profile")).GetProperty("imageUrl").GetString());
    }

    [Fact]
    public async Task A_venue_image_that_is_not_an_image_is_refused()
    {
        var at = await app.HostAloneAsync();

        var response = await at.Host.Http.PostAsync("/api/hosts/profile/image", Upload("<html></html>"u8.ToArray()));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Without_storage_a_venue_image_answers_storage_off()
    {
        var at = await app.HostAloneAsync();
        app.Images.IsConfigured = false;
        try
        {
            var response = await at.Host.Http.PostAsync("/api/hosts/profile/image", Upload(Png));

            await AssertProblem(response, HttpStatusCode.ServiceUnavailable, "storage_off");
        }
        finally
        {
            app.Images.IsConfigured = true;
        }
    }

    // ── tonight by hour ──
    // Friday 13 November 2026, 23:30 UTC = 00:30 in Podgorica. The party runs 23:00–04:00 local (22:00–03:00 UTC),
    // so the chart starts at 21:00 local (20:00 UTC) and "now" is the fourth bar.

    private static readonly DateTime Now = VenueTestHelpers.Utc(2026, 11, 13, 23, 30);
    private static readonly DateTime Start = VenueTestHelpers.Utc(2026, 11, 13, 22);

    private async Task<VenueTestHelpers.Alone> TonightAsync(params (int Hour, int Minute, int Guests)[] scans)
    {
        var at = await app.HostAloneAsync();
        var party = await app.PartyAtAsync(at, Start, Start.AddHours(5));
        foreach (var (hour, minute, guests) in scans)
            await app.AdmitAsync(party, VenueTestHelpers.Utc(2026, 11, 13, hour, minute), guests);
        return at;
    }

    /// <summary>Two earlier Fridays at the same venue: 30 in at 23:30 UTC, 60 at 00:30 UTC.</summary>
    private async Task HistoryAsync(VenueTestHelpers.Alone at)
    {
        foreach (var weeksBack in new[] { 1, 2 })
        {
            var start = Start.AddDays(-7 * weeksBack);
            var past = await app.PartyAtAsync(at, start, start.AddHours(5), title: "Earlier Friday");
            await app.AdmitAsync(past, start.AddMinutes(90), 30);
            await app.AdmitAsync(past, start.AddMinutes(150), 60);
        }
    }

    private async Task<JsonElement> TonightOfAsync(VenueTestHelpers.Alone at)
    {
        using var _ = app.Clock.At(Now);
        return (await app.CreateClient().GetFromJsonAsync<JsonElement>($"/api/venues/{at.VenueId}")).GetProperty("tonight");
    }

    [Fact]
    public async Task Tonight_by_hour_shows_what_happened_then_now_then_what_usually_happens()
    {
        var at = await TonightAsync((22, 10, 10), (23, 5, 20));
        await HistoryAsync(at);

        var tonight = await TonightOfAsync(at);
        var hours = tonight.GetProperty("hours").EnumerateArray().ToList();

        Assert.Equal(8, hours.Count);
        Assert.Equal(Enumerable.Range(0, 8).Select(i => VenueTestHelpers.Utc(2026, 11, 13, 20).AddHours(i)), hours.Select(h => h.GetProperty("at").GetDateTime().ToUniversalTime()));
        Assert.Equal(["past", "past", "past", "now", "usual", "usual", "usual", "usual"], hours.Select(h => h.GetProperty("kind").GetString()));
        // Past: what came in during the three hours before each bar ends. Now: the three hours up to now. Later: the usual.
        Assert.Equal([0, 0, 0.11, 0.33, 1, 1, 0.67, 0], hours.Select(h => h.GetProperty("level").GetDouble()));
        Assert.All(hours, h => Assert.InRange(h.GetProperty("level").GetDouble(), 0, 1));
        Assert.Equal(VenueTestHelpers.Utc(2026, 11, 14, 0), tonight.GetProperty("usualPeakAt").GetDateTime().ToUniversalTime());
        Assert.Equal("filling", tonight.GetProperty("trend").GetString());
    }

    [Fact]
    public async Task Without_history_the_usual_hours_are_left_out()
    {
        var at = await TonightAsync((22, 10, 10), (23, 5, 20));

        var tonight = await TonightOfAsync(at);

        Assert.Equal(["past", "past", "past", "now"], tonight.GetProperty("hours").EnumerateArray().Select(h => h.GetProperty("kind").GetString()));
        Assert.Equal([0, 0, 0.33, 1], tonight.GetProperty("hours").EnumerateArray().Select(h => h.GetProperty("level").GetDouble()));
        Assert.Equal(JsonValueKind.Null, tonight.GetProperty("usualPeakAt").ValueKind);
    }

    [Theory]
    [InlineData(20, 5, "thinning")]
    [InlineData(10, 10, "steady")]
    [InlineData(10, 12, "steady")]
    [InlineData(10, 8, "steady")]
    [InlineData(10, 20, "filling")]
    public async Task The_trend_compares_the_last_hour_with_the_hour_before(int hourBefore, int lastHour, string trend)
    {
        var at = await TonightAsync((22, 0, hourBefore), (23, 10, lastHour));

        Assert.Equal(trend, (await TonightOfAsync(at)).GetProperty("trend").GetString());
    }

    [Fact]
    public async Task With_no_scans_there_is_no_trend()
    {
        var at = await TonightAsync();

        var tonight = await TonightOfAsync(at);

        Assert.Equal(JsonValueKind.Null, tonight.GetProperty("trend").ValueKind);
        Assert.All(tonight.GetProperty("hours").EnumerateArray(), h => Assert.Equal(0, h.GetProperty("level").GetDouble()));
    }

    [Fact]
    public async Task A_venue_with_nothing_on_tonight_has_no_chart()
    {
        var at = await app.HostAloneAsync();
        await app.PartyAtAsync(at, Start.AddDays(1), Start.AddDays(1).AddHours(5)); // tomorrow night

        Assert.Equal(JsonValueKind.Null, (await TonightOfAsync(at)).ValueKind);
    }

    [Fact]
    public async Task A_party_later_tonight_gets_a_chart_of_what_usually_happens()
    {
        var at = await app.HostAloneAsync();
        await app.PartyAtAsync(at, Start, Start.AddHours(5));
        await HistoryAsync(at);

        JsonElement tonight;
        using (app.Clock.At(VenueTestHelpers.Utc(2026, 11, 13, 18)))
            tonight = (await app.CreateClient().GetFromJsonAsync<JsonElement>($"/api/venues/{at.VenueId}")).GetProperty("tonight");

        Assert.Equal(Enumerable.Repeat("usual", 8), tonight.GetProperty("hours").EnumerateArray().Select(h => h.GetProperty("kind").GetString()));
        Assert.Equal(JsonValueKind.Null, tonight.GetProperty("trend").ValueKind);
    }

    // ── share page ──

    [Fact]
    public async Task The_venue_share_page_carries_the_preview_tags_and_opens_the_venue_in_the_app()
    {
        var at = await app.HostAloneAsync();

        var response = await app.CreateClient().GetAsync($"/v/{at.VenueId}");
        var html = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/html", response.Content.Headers.ContentType!.MediaType);
        Assert.Contains("<meta property=\"og:title\" content=\"Test venue, Podgorica\">", html);
        Assert.Contains("<meta property=\"og:description\" content=\"See what is on tonight.\">", html);
        Assert.Contains("<meta property=\"og:image\" content=\"http://localhost/og.png\">", html);
        Assert.Contains($"findmypartymobileapp://venue/{at.VenueId}", html);
    }

    [Theory]
    [InlineData("/v/00000000-0000-0000-0000-000000000001")]
    [InlineData("/v/not-a-venue")]
    public async Task A_venue_share_link_that_leads_nowhere_is_a_plain_404_page(string path)
    {
        var response = await app.CreateClient().GetAsync(path);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Contains("does not lead anywhere", await response.Content.ReadAsStringAsync());
    }

    // ── demo ──

    [Fact]
    public async Task The_demo_venues_get_their_kind_area_building_line_up_age_limit_and_a_history_of_nights()
    {
        var database = "seed_" + Guid.NewGuid().ToString("N")[..10];
        var settings = new Dictionary<string, string?> { ["ConnectionStrings:DefaultConnection"] = app.ConnectionStringFor(database), ["Seed:Demo"] = "true" };
        using (var first = app.With(settings)) first.CreateClient();
        using var seeded = app.With(settings); // a second start must not add anything twice
        var http = seeded.CreateClient();

        var venues = (await http.GetFromJsonAsync<JsonElement>("/api/venues?pageSize=100")).EnumerateArray().ToList();
        var monkey = venues.Single(v => v.GetProperty("name").GetString() == "Monkey");
        var page = await http.GetFromJsonAsync<JsonElement>($"/api/venues/{monkey.GetProperty("id").GetGuid()}");
        var running = await http.GetFromJsonAsync<JsonElement>($"/api/parties/{monkey.GetProperty("partyId").GetGuid()}");

        Assert.Equal(("Club", "Stara Varoš"), (monkey.GetProperty("kind").GetString(), monkey.GetProperty("area").GetString()));
        Assert.Equal(9, monkey.GetProperty("footprint").GetProperty("ring").GetArrayLength());
        Assert.Equal(18, monkey.GetProperty("footprint").GetProperty("heightM").GetDouble());
        Assert.All(venues, v => Assert.NotEqual(JsonValueKind.Null, v.GetProperty("footprint").ValueKind));
        Assert.All(venues, v => Assert.NotEqual(JsonValueKind.Null, v.GetProperty("kind").ValueKind));
        Assert.Equal(("Bar", "Centar"), venues.Where(v => v.GetProperty("name").GetString() == "Dr. House").Select(v => (v.GetProperty("kind").GetString(), v.GetProperty("area").GetString())).Single());

        Assert.Equal("Lena K, DJ Proximus", running.GetProperty("lineupText").GetString());
        var acts = running.GetProperty("acts").EnumerateArray().ToList();
        Assert.Equal(running.GetProperty("startsAt").GetDateTime(), acts[0].GetProperty("startsAt").GetDateTime());
        Assert.Equal(running.GetProperty("startsAt").GetDateTime().AddHours(2), acts[1].GetProperty("startsAt").GetDateTime());
        Assert.Equal(18, running.GetProperty("ageLimit").GetInt32());
        Assert.Equal("Stara Varoš", running.GetProperty("venueArea").GetString());

        var studentNight = page.GetProperty("parties").EnumerateArray().Single(p => p.GetProperty("title").GetString() == "Student Night");
        Assert.Equal(0m, studentNight.GetProperty("price").GetDecimal());
        Assert.Equal(DayOfWeek.Thursday, CityClock.Local(studentNight.GetProperty("startsAt").GetDateTime().ToUniversalTime(), "podgorica").DayOfWeek);
        Assert.NotEqual(JsonValueKind.Null, page.GetProperty("tonight").ValueKind);

        using var scope = seeded.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var monkeyId = monkey.GetProperty("id").GetGuid();
        var now = DateTime.UtcNow;
        var pastNights = await db.Parties.Where(p => p.VenueId == monkeyId && p.EndsAt < now).Select(p => p.Id).ToListAsync();
        var pastScans = await db.CheckIns.Where(c => pastNights.Contains(c.PartyId)).CountAsync();
        Assert.True(pastNights.Count >= 12, $"six Fridays and six Saturdays, got {pastNights.Count}");
        Assert.True(pastScans > pastNights.Count * 10, "past nights have scans");
        Assert.Equal(1, await db.Parties.CountAsync(p => p.VenueId == monkeyId && p.Title == "Student Night" && p.EndsAt > now));
        Assert.Equal(pastNights.Count, pastNights.Distinct().Count());
    }

    // ── helpers ──

    private async Task<Guid> PublishedAsync(VenueTestHelpers.Alone at, object body)
    {
        var created = await at.Host.Http.PostAsJsonAsync("/api/parties", body);
        created.EnsureSuccessStatusCode();
        var id = (await created.Content.ReadFromJsonAsync<TestApp.IdBody>())!.Id;
        (await at.Host.Http.PostAsync($"/api/parties/{id}/publish", null)).EnsureSuccessStatusCode();
        return id;
    }

    internal static async Task AssertProblem(HttpResponseMessage response, HttpStatusCode status, string code)
    {
        Assert.Equal(status, response.StatusCode);
        Assert.Equal(code, (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString());
    }
}

/// <summary>Helpers for the party, venue, city and follow tests: venues on a spot of their own, parties at set times, door scans.</summary>
public static class VenueTestHelpers
{
    public record Alone(Actor Host, Guid VenueId, double Latitude, double Longitude)
    {
        /// <summary>Query string that finds only what sits on this spot.</summary>
        public string Near => string.Create(CultureInfo.InvariantCulture, $"lat={Latitude}&lng={Longitude}&radiusKm=1&pageSize=100");
    }

    /// <summary>A host whose venue sits alone on a spot of its own, in the city given.</summary>
    public static async Task<Alone> HostAloneAsync(this TestApp app, string city = "podgorica", string? kind = null, string? area = null)
    {
        var (lat, lng) = TestApp.NewSpot();
        var host = await app.HostAsync();
        var hostId = host.Id.ToString();
        var venueId = await app.WithDb(async db =>
        {
            var v = await db.VenueProfiles.SingleAsync(x => x.UserId == hostId);
            v.Latitude = lat;
            v.Longitude = lng;
            v.CitySlug = city;
            v.Kind = kind;
            v.Area = area;
            await db.SaveChangesAsync();
            return v.Id;
        });
        return new Alone(host, venueId, lat, lng);
    }

    public static object PartyInput(Alone at, DateTime startsAt, DateTime endsAt, decimal price = 5, string title = "Neon Friday",
        object? acts = null, int? ageLimit = null, int? holdMinutes = null, string genre = "Techno") => new
    {
        title,
        description = "A party.",
        price,
        capacity = 500,
        startsAt,
        endsAt,
        latitude = at.Latitude,
        longitude = at.Longitude,
        genre,
        acts,
        ageLimit,
        holdMinutes,
    };

    /// <summary>A published party at these times, which may lie in the past (set straight in the database).</summary>
    public static async Task<Guid> PartyAtAsync(this TestApp app, Alone at, DateTime startsAt, DateTime endsAt, decimal price = 5, string title = "Neon Friday")
    {
        var created = await at.Host.Http.PostAsJsonAsync("/api/parties", PartyInput(at, startsAt, endsAt, price, title));
        created.EnsureSuccessStatusCode();
        var id = (await created.Content.ReadFromJsonAsync<TestApp.IdBody>())!.Id;
        await app.WithDb(db => db.Parties.Where(p => p.Id == id).ExecuteUpdateAsync(s => s.SetProperty(p => p.Status, PartyStatus.Published)));
        return id;
    }

    /// <summary>A guest's booking for `guests`, all of them let in at `at` by one scan.</summary>
    public static Task AdmitAsync(this TestApp app, Guid partyId, DateTime at, int guests) => app.WithDb(async db =>
    {
        var party = await db.Parties.AsNoTracking().SingleAsync(p => p.Id == partyId);
        var guest = Guid.NewGuid();
        var booking = new Booking(guest, partyId, guests, party.Price, Guid.NewGuid().ToString(), party.EndsAt);
        db.Bookings.Add(booking);
        db.Entry(booking).Property(b => b.CheckedInCount).CurrentValue = guests;
        db.Entry(booking).Property(b => b.FirstCheckedInAt).CurrentValue = at;
        db.Entry(booking).Property(b => b.Status).CurrentValue = BookingStatus.Confirmed;
        db.CheckIns.Add(new CheckIn { Id = Guid.NewGuid(), BookingId = booking.Id, PartyId = partyId, Admitted = guests, At = at, ByUserId = party.HostId, GuestUserId = guest });
        await db.SaveChangesAsync();
        await db.Parties.Where(p => p.Id == partyId).ExecuteUpdateAsync(s => s.SetProperty(p => p.TicketsSold, p => p.TicketsSold + guests));
        return 0;
    });

    public static DateTime Utc(int year, int month, int day, int hour, int minute = 0) => new(year, month, day, hour, minute, 0, DateTimeKind.Utc);
}
