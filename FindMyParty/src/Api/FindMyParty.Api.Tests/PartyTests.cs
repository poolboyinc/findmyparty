using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using FindMyParty.Api.Bookings;
using FindMyParty.Api.Parties;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace FindMyParty.Api.Tests;

[Collection("api")]
public class PartyTests(TestApp app)
{
    public static TheoryData<string, object> NonsenseParties => new()
    {
        { "negative price", new { title = "X", description = "d", price = -1, capacity = 10, startsAt = In(4), endsAt = In(9), latitude = 42.4, longitude = 19.2 } },
        { "no capacity", new { title = "X", description = "d", price = 5, capacity = 0, startsAt = In(4), endsAt = In(9), latitude = 42.4, longitude = 19.2 } },
        { "ends before it starts", new { title = "X", description = "d", price = 5, capacity = 10, startsAt = In(9), endsAt = In(4), latitude = 42.4, longitude = 19.2 } },
        { "latitude off the planet", new { title = "X", description = "d", price = 5, capacity = 10, startsAt = In(4), endsAt = In(9), latitude = 142.4, longitude = 19.2 } },
        { "no title", new { title = "", description = "d", price = 5, capacity = 10, startsAt = In(4), endsAt = In(9), latitude = 42.4, longitude = 19.2 } },
        { "title too long", new { title = new string('x', 201), description = "d", price = 5, capacity = 10, startsAt = In(4), endsAt = In(9), latitude = 42.4, longitude = 19.2 } },
    };

    private static DateTime In(int hours) => DateTime.UtcNow.AddHours(hours);

    [Theory]
    [MemberData(nameof(NonsenseParties))]
    public async Task A_party_with_nonsense_values_is_refused(string why, object body)
    {
        var host = await app.HostAsync();

        var response = await host.Http.PostAsJsonAsync("/api/parties", body);

        Assert.True(response.StatusCode == HttpStatusCode.BadRequest, $"{why}: expected 400, got {(int)response.StatusCode}");
    }

    [Fact]
    public async Task A_host_cannot_feature_their_own_party()
    {
        var host = await app.HostAsync();
        var body = new { title = "Pick me", description = "d", price = 5, capacity = 10, startsAt = In(4), endsAt = In(9), latitude = 42.4, longitude = 19.2, featured = true };

        var created = await host.Http.PostAsJsonAsync("/api/parties", body);
        var id = (await created.Content.ReadFromJsonAsync<TestApp.IdBody>())!.Id;

        Assert.False(await app.WithDb(db => db.Parties.Where(p => p.Id == id).Select(p => p.Featured).SingleAsync()));
    }

    [Fact]
    public async Task Cancelling_a_party_cancels_its_bookings()
    {
        var host = await app.HostAsync();
        var party = await app.PublishedPartyAsync(host);
        var booking = await (await app.UserAsync()).BookedAsync(party, tickets: 3);

        (await host.Http.PostAsync($"/api/parties/{party}/cancel", null)).EnsureSuccessStatusCode();

        Assert.Equal(BookingStatus.Cancelled, await app.WithDb(db => db.Bookings.Where(b => b.Id == booking).Select(b => b.Status).SingleAsync()));
        Assert.Equal(0, await app.TicketsSoldAsync(party));
    }

    [Fact]
    public async Task A_sold_out_party_stays_in_the_feed_marked_sold_out()
    {
        var party = await app.PublishedPartyAsync(await app.HostAsync(), capacity: 1);
        await (await app.UserAsync()).BookedAsync(party);

        var feed = await app.CreateClient().GetFromJsonAsync<List<PartyResponse>>("/api/parties?pageSize=100");

        Assert.True(feed!.Single(p => p.Id == party).IsSoldOut);
    }

    [Theory]
    [InlineData("page=0")]
    [InlineData("page=-3&pageSize=0")]
    [InlineData("pageSize=100000")]
    public async Task Odd_paging_values_do_not_break_the_feed(string query)
    {
        var response = await app.CreateClient().GetAsync($"/api/parties?{query}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True((await response.Content.ReadFromJsonAsync<List<PartyResponse>>())!.Count <= 100);
    }

    [Fact]
    public async Task With_a_radius_the_feed_only_returns_parties_nearby()
    {
        var host = await app.HostAsync();
        var (lat, lng) = TestApp.NewSpot();
        var here = await PublishedAtAsync(host, lat, lng);
        var nextTown = await PublishedAtAsync(host, lat + 0.35, lng); // about 39 km north
        var query = string.Create(System.Globalization.CultureInfo.InvariantCulture, $"lat={lat}&lng={lng}&radiusKm=10&pageSize=100");

        var near = await app.CreateClient().GetFromJsonAsync<List<PartyResponse>>($"/api/parties?{query}");

        Assert.Contains(near!, p => p.Id == here);
        Assert.DoesNotContain(near!, p => p.Id == nextTown);
    }

    [Fact]
    public async Task A_draft_is_visible_to_its_host_only()
    {
        var host = await app.HostAsync();
        var draft = await app.DraftPartyAsync(host);

        Assert.Equal(HttpStatusCode.NotFound, (await app.CreateClient().GetAsync($"/api/parties/{draft}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await (await app.UserAsync()).Http.GetAsync($"/api/parties/{draft}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await host.Http.GetAsync($"/api/parties/{draft}")).StatusCode);
    }

    [Fact]
    public async Task A_host_cannot_change_another_hosts_party()
    {
        var party = await app.DraftPartyAsync(await app.HostAsync());

        var response = await (await app.HostAsync()).Http.PostAsync($"/api/parties/{party}/publish", null);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    // ── images ──

    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1];

    private static MultipartFormDataContent Upload(byte[] bytes, string fileName, string contentType)
    {
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        return new MultipartFormDataContent { { file, "file", fileName } };
    }

    [Fact]
    public async Task An_image_is_stored_under_a_name_the_server_chooses_with_its_real_type()
    {
        var host = await app.HostAsync();
        var party = await app.DraftPartyAsync(host);

        // The phone always says "upload.jpg / image/jpeg", whatever the file really is.
        var response = await host.Http.PostAsync($"/api/parties/{party}/image", Upload(Png, "upload.jpg", "image/jpeg"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var stored = app.Images.Uploads.Last(u => u.Key.StartsWith($"parties/{party}/"));
        Assert.EndsWith(".png", stored.Key);
        Assert.Equal("image/png", stored.ContentType);
    }

    [Fact]
    public async Task A_file_that_is_not_an_image_is_refused_whatever_it_is_called()
    {
        var host = await app.HostAsync();
        var party = await app.DraftPartyAsync(host);
        var html = "<html><script>alert(1)</script></html>"u8.ToArray();

        var response = await host.Http.PostAsync($"/api/parties/{party}/image", Upload(html, "poster.png", "image/png"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.DoesNotContain(app.Images.Uploads, u => u.Key.StartsWith($"parties/{party}/"));
    }

    [Fact]
    public async Task Without_storage_a_party_image_answers_storage_off()
    {
        var host = await app.HostAsync();
        var party = await app.DraftPartyAsync(host);
        app.Images.IsConfigured = false;
        try
        {
            var response = await host.Http.PostAsync($"/api/parties/{party}/image", Upload(Png, "upload.jpg", "image/jpeg"));

            await VenueTests.AssertProblem(response, HttpStatusCode.ServiceUnavailable, "storage_off");
        }
        finally
        {
            app.Images.IsConfigured = true;
        }
    }

    // ── cities ──

    [Fact]
    public async Task The_feed_filters_by_city_and_refuses_a_city_it_does_not_know()
    {
        var budva = await app.HostAloneAsync(city: "budva", area: "Stari grad");
        var party = await PublishedAsync(budva, VenueTestHelpers.PartyInput(budva, In(4), In(9)));
        var near = budva.Near;

        var inBudva = await app.CreateClient().GetFromJsonAsync<JsonElement>($"/api/parties?city=budva&{near}");
        var inKotor = await app.CreateClient().GetFromJsonAsync<JsonElement>($"/api/parties?city=kotor&{near}");
        var unknown = await app.CreateClient().GetAsync("/api/parties?city=atlantis");

        var row = Assert.Single(inBudva.EnumerateArray());
        Assert.Equal(party, row.GetProperty("id").GetGuid());
        Assert.Equal(("budva", "Stari grad"), (row.GetProperty("city").GetString(), row.GetProperty("venueArea").GetString()));
        Assert.Empty(inKotor.EnumerateArray());
        await VenueTests.AssertProblem(unknown, HttpStatusCode.BadRequest, "city_unknown");
    }

    // ── line-up ──

    private static object[] Acts(DateTime start, params (string Name, string? Role, double Hours)[] acts) =>
        acts.Select(a => (object)new { name = a.Name, role = a.Role, startsAt = start.AddHours(a.Hours) }).ToArray();

    [Fact]
    public async Task Acts_come_back_in_time_order_and_the_first_one_fills_the_performer_fields()
    {
        var at = await app.HostAloneAsync();
        var start = In(4);
        var body = VenueTestHelpers.PartyInput(at, start, start.AddHours(5), acts: Acts(start, ("DJ Proximus", "DJ", 2), ("Lena K", "DJ", 0), ("Closing set", null, 4)));

        var party = await PublishedAsync(at, body);
        var detail = await app.CreateClient().GetFromJsonAsync<JsonElement>($"/api/parties/{party}");
        var feedRow = Assert.Single((await app.CreateClient().GetFromJsonAsync<JsonElement>($"/api/parties?{at.Near}")).EnumerateArray());
        var mine = (await at.Host.Http.GetFromJsonAsync<JsonElement>("/api/parties/mine")).EnumerateArray().Single(p => p.GetProperty("id").GetGuid() == party);

        var acts = detail.GetProperty("acts").EnumerateArray().ToList();
        Assert.Equal(["Lena K", "DJ Proximus", "Closing set"], acts.Select(a => a.GetProperty("name").GetString()));
        Assert.Equal(["DJ", "DJ", null], acts.Select(a => a.GetProperty("role").GetString()));
        Assert.Equal(start.AddHours(2), acts[1].GetProperty("startsAt").GetDateTime().ToUniversalTime(), TimeSpan.FromMilliseconds(1));
        Assert.Equal(("Lena K", "DJ"), (detail.GetProperty("performerName").GetString(), detail.GetProperty("performerType").GetString()));
        Assert.Equal("Lena K, DJ Proximus, Closing set", feedRow.GetProperty("lineupText").GetString());
        Assert.Equal("Lena K, DJ Proximus, Closing set", mine.GetProperty("lineupText").GetString());
        Assert.Equal(3, mine.GetProperty("acts").GetArrayLength());
    }

    [Theory]
    [InlineData(-1)]   // before the doors open
    [InlineData(5)]    // as the party ends
    [InlineData(7)]    // after it
    public async Task An_act_outside_the_partys_hours_is_refused(double hours)
    {
        var at = await app.HostAloneAsync();
        var start = In(4);

        var response = await at.Host.Http.PostAsJsonAsync("/api/parties", VenueTestHelpers.PartyInput(at, start, start.AddHours(5), acts: Acts(start, ("Lena K", "DJ", hours))));

        await VenueTests.AssertProblem(response, HttpStatusCode.BadRequest, "acts_invalid");
    }

    [Fact]
    public async Task A_line_up_has_at_most_eight_acts_each_with_a_name()
    {
        var at = await app.HostAloneAsync();
        var start = In(4);
        var nine = Enumerable.Range(0, 9).Select(i => ($"Act {i}", (string?)"DJ", i * 0.5)).ToArray();

        var tooMany = await at.Host.Http.PostAsJsonAsync("/api/parties", VenueTestHelpers.PartyInput(at, start, start.AddHours(5), acts: Acts(start, nine)));
        var nameless = await at.Host.Http.PostAsJsonAsync("/api/parties", VenueTestHelpers.PartyInput(at, start, start.AddHours(5), acts: Acts(start, (" ", "DJ", 1))));
        var eight = await at.Host.Http.PostAsJsonAsync("/api/parties", VenueTestHelpers.PartyInput(at, start, start.AddHours(5), acts: Acts(start, nine[..8])));

        await VenueTests.AssertProblem(tooMany, HttpStatusCode.BadRequest, "acts_invalid");
        await VenueTests.AssertProblem(nameless, HttpStatusCode.BadRequest, "acts_invalid");
        Assert.Equal(HttpStatusCode.Created, eight.StatusCode);
    }

    [Fact]
    public async Task The_line_up_can_change_after_publishing_until_the_party_ends()
    {
        var at = await app.HostAloneAsync();
        var start = In(4);
        var party = await PublishedAsync(at, VenueTestHelpers.PartyInput(at, start, start.AddHours(5), acts: Acts(start, ("Lena K", "DJ", 0))));

        var changed = await at.Host.Http.PutAsJsonAsync($"/api/parties/{party}/acts", new { acts = Acts(start, ("Kontra", "DJ", 1), ("Trio Morača", "Band", 0)) });
        var outside = await at.Host.Http.PutAsJsonAsync($"/api/parties/{party}/acts", new { acts = Acts(start, ("Kontra", "DJ", 6)) });
        var byOther = await (await app.HostAsync()).Http.PutAsJsonAsync($"/api/parties/{party}/acts", new { acts = Acts(start, ("Kontra", "DJ", 1)) });
        var detail = await app.CreateClient().GetFromJsonAsync<JsonElement>($"/api/parties/{party}");

        Assert.Equal(HttpStatusCode.NoContent, changed.StatusCode);
        await VenueTests.AssertProblem(outside, HttpStatusCode.BadRequest, "acts_invalid");
        Assert.Equal(HttpStatusCode.Forbidden, byOther.StatusCode);
        Assert.Equal(["Trio Morača", "Kontra"], detail.GetProperty("acts").EnumerateArray().Select(a => a.GetProperty("name").GetString()));
        Assert.Equal(("Trio Morača", "Band"), (detail.GetProperty("performerName").GetString(), detail.GetProperty("performerType").GetString()));

        var ended = await app.PartyAtAsync(at, In(-8), In(-1));
        var late = await at.Host.Http.PutAsJsonAsync($"/api/parties/{ended}/acts", new { acts = Acts(In(-8), ("Kontra", "DJ", 1)) });
        Assert.Equal(HttpStatusCode.Conflict, late.StatusCode);
    }

    [Fact]
    public async Task Clearing_the_line_up_clears_the_performer_and_editing_a_draft_without_acts_keeps_them()
    {
        var at = await app.HostAloneAsync();
        var start = In(4);
        var draft = (await (await at.Host.Http.PostAsJsonAsync("/api/parties", VenueTestHelpers.PartyInput(at, start, start.AddHours(5), acts: Acts(start, ("Lena K", "DJ", 0)))))
            .Content.ReadFromJsonAsync<TestApp.IdBody>())!.Id;

        var edited = await at.Host.Http.PatchAsJsonAsync($"/api/parties/{draft}", VenueTestHelpers.PartyInput(at, start, start.AddHours(5), title: "Renamed"));
        var kept = await at.Host.Http.GetFromJsonAsync<JsonElement>($"/api/parties/{draft}");
        await at.Host.Http.PutAsJsonAsync($"/api/parties/{draft}/acts", new { acts = Array.Empty<object>() });
        var cleared = await at.Host.Http.GetFromJsonAsync<JsonElement>($"/api/parties/{draft}");

        Assert.Equal(HttpStatusCode.NoContent, edited.StatusCode);
        Assert.Equal(("Renamed", "Lena K", 1), (kept.GetProperty("title").GetString(), kept.GetProperty("performerName").GetString(), kept.GetProperty("acts").GetArrayLength()));
        Assert.Equal(0, cleared.GetProperty("acts").GetArrayLength());
        Assert.Equal(JsonValueKind.Null, cleared.GetProperty("performerName").ValueKind);
    }

    // ── age limit and hold ──

    [Theory]
    [InlineData(null, true)]
    [InlineData(16, true)]
    [InlineData(18, true)]
    [InlineData(21, true)]
    [InlineData(17, false)]
    [InlineData(0, false)]
    public async Task The_age_limit_is_none_16_18_or_21(int? ageLimit, bool accepted)
    {
        var at = await app.HostAloneAsync();

        var response = await at.Host.Http.PostAsJsonAsync("/api/parties", VenueTestHelpers.PartyInput(at, In(4), In(9), ageLimit: ageLimit));

        Assert.Equal(accepted ? HttpStatusCode.Created : HttpStatusCode.BadRequest, response.StatusCode);
        if (!accepted) return;
        var id = (await response.Content.ReadFromJsonAsync<TestApp.IdBody>())!.Id;
        var detail = await at.Host.Http.GetFromJsonAsync<JsonElement>($"/api/parties/{id}");
        Assert.Equal(ageLimit, detail.GetProperty("ageLimit").ValueKind == JsonValueKind.Null ? null : detail.GetProperty("ageLimit").GetInt32());
    }

    [Theory]
    [InlineData(null, 90)]
    [InlineData(15, 15)]
    [InlineData(600, 600)]
    [InlineData(14, null)]
    [InlineData(601, null)]
    public async Task A_pass_is_held_15_to_600_minutes_90_unless_told(int? holdMinutes, int? stored)
    {
        var at = await app.HostAloneAsync();

        var response = await at.Host.Http.PostAsJsonAsync("/api/parties", VenueTestHelpers.PartyInput(at, In(4), In(9), holdMinutes: holdMinutes));

        if (stored is null)
        {
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            return;
        }
        var id = (await response.Content.ReadFromJsonAsync<TestApp.IdBody>())!.Id;
        Assert.Equal(stored, (await at.Host.Http.GetFromJsonAsync<JsonElement>($"/api/parties/{id}")).GetProperty("holdMinutes").GetInt32());
        var mine = (await at.Host.Http.GetFromJsonAsync<JsonElement>("/api/parties/mine")).EnumerateArray().Single(p => p.GetProperty("id").GetGuid() == id);
        Assert.Equal(stored, mine.GetProperty("holdMinutes").GetInt32());
    }

    // ── the party page ──

    [Fact]
    public async Task The_party_page_carries_its_crowd_place_and_age_limit_for_a_signed_out_caller()
    {
        var at = await app.HostAloneAsync(kind: "Club", area: "Stara Varoš");
        var party = await PublishedAsync(at, VenueTestHelpers.PartyInput(at, In(4), In(9), ageLimit: 18));
        var guest = await app.UserAsync();
        for (var i = 0; i < 4; i++) await guest.BookedAsync(party, tickets: 6);

        var before = await app.CreateClient().GetFromJsonAsync<JsonElement>($"/api/parties/{party}");
        await app.AdmitAsync(party, DateTime.UtcNow, 55);
        var after = await app.CreateClient().GetFromJsonAsync<JsonElement>($"/api/parties/{party}");

        Assert.Equal(("20+", "expected"), (before.GetProperty("crowdLevel").GetString(), before.GetProperty("crowdSource").GetString()));
        Assert.Equal(("50+", "live"), (after.GetProperty("crowdLevel").GetString(), after.GetProperty("crowdSource").GetString()));
        Assert.Equal(("podgorica", "Stara Varoš", "Somewhere 1"),
            (after.GetProperty("city").GetString(), after.GetProperty("venueArea").GetString(), after.GetProperty("venueAddress").GetString()));
        Assert.Equal(18, after.GetProperty("ageLimit").GetInt32());
        Assert.Equal(90, after.GetProperty("holdMinutes").GetInt32());
        Assert.Equal(0, after.GetProperty("acts").GetArrayLength());
    }

    [Fact]
    public async Task A_party_without_acts_falls_back_to_its_performer_for_the_line_up_text()
    {
        var at = await app.HostAloneAsync();
        var body = new { title = "Old style", description = "d", price = 5, capacity = 10, startsAt = In(4), endsAt = In(9), latitude = at.Latitude, longitude = at.Longitude, performerName = "VRT", performerType = "DJ" };

        await PublishedAsync(at, body);
        var row = Assert.Single((await app.CreateClient().GetFromJsonAsync<JsonElement>($"/api/parties?{at.Near}")).EnumerateArray());

        Assert.Equal("VRT", row.GetProperty("lineupText").GetString());
        Assert.Equal(JsonValueKind.Null, row.GetProperty("ageLimit").ValueKind);
    }

    // ── share page ──

    [Fact]
    public async Task The_party_share_page_carries_the_preview_tags_and_opens_the_party_in_the_app()
    {
        var at = await app.HostAloneAsync();
        await at.Host.Http.PatchAsJsonAsync("/api/hosts/profile", new { venueName = "Monkey" });
        var start = VenueTestHelpers.Utc(2027, 11, 12, 22); // Friday, 23:00 in Podgorica
        var party = await PublishedAsync(at, VenueTestHelpers.PartyInput(at, start, start.AddHours(5), price: 7.5m));

        var response = await app.CreateClient().GetAsync($"/p/{party}");
        var html = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("<meta property=\"og:title\" content=\"Neon Friday at Monkey\">", html);
        Assert.Contains("<meta property=\"og:description\" content=\"Fri 12 Nov, 23:00. €7.50 at the door.\">", html.Replace("&#x20AC;", "€"));
        Assert.Contains("<meta property=\"og:image\" content=\"http://localhost/og.png\">", html);
        Assert.Contains($"findmypartymobileapp://party/{party}", html);
    }

    [Fact]
    public async Task The_party_share_page_uses_the_party_image_and_says_free_when_it_is()
    {
        var at = await app.HostAloneAsync();
        var start = VenueTestHelpers.Utc(2027, 11, 12, 22);
        var party = await PublishedAsync(at, VenueTestHelpers.PartyInput(at, start, start.AddHours(5), price: 0));
        await app.WithDb(db => db.Parties.Where(p => p.Id == party).ExecuteUpdateAsync(s => s.SetProperty(p => p.ImageUrl, "https://images.test/neon.png")));

        var html = await (await app.CreateClient().GetAsync($"/p/{party}")).Content.ReadAsStringAsync();

        Assert.Contains("<meta property=\"og:image\" content=\"https://images.test/neon.png\">", html);
        Assert.Contains("Fri 12 Nov, 23:00. Free entry.", html);
    }

    [Fact]
    public async Task A_party_share_link_to_a_draft_or_nothing_is_a_plain_404_page()
    {
        var draft = await app.DraftPartyAsync(await app.HostAsync());

        foreach (var path in new[] { $"/p/{draft}", $"/p/{Guid.NewGuid()}", "/p/not-a-party" })
        {
            var response = await app.CreateClient().GetAsync(path);
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.Contains("does not lead anywhere", await response.Content.ReadAsStringAsync());
        }
    }

    private static async Task<Guid> PublishedAsync(VenueTestHelpers.Alone at, object body)
    {
        var created = await at.Host.Http.PostAsJsonAsync("/api/parties", body);
        created.EnsureSuccessStatusCode();
        var id = (await created.Content.ReadFromJsonAsync<TestApp.IdBody>())!.Id;
        (await at.Host.Http.PostAsync($"/api/parties/{id}/publish", null)).EnsureSuccessStatusCode();
        return id;
    }

    private async Task<Guid> PublishedAtAsync(Actor host, double lat, double lng)
    {
        var body = new { title = "Somewhere", description = "d", price = 5, capacity = 10, startsAt = In(4), endsAt = In(9), latitude = lat, longitude = lng };
        var id = (await (await host.Http.PostAsJsonAsync("/api/parties", body)).Content.ReadFromJsonAsync<TestApp.IdBody>())!.Id;
        (await host.Http.PostAsync($"/api/parties/{id}/publish", null)).EnsureSuccessStatusCode();
        return id;
    }
}
