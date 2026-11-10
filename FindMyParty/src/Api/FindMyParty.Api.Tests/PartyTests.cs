using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
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
        var podgorica = await PublishedAtAsync(host, 42.4411, 19.2594);
        var budva = await PublishedAtAsync(host, 42.2911, 18.8403); // about 38 km away

        var near = await app.CreateClient().GetFromJsonAsync<List<PartyResponse>>("/api/parties?lat=42.4411&lng=19.2594&radiusKm=10&pageSize=100");

        Assert.Contains(near!, p => p.Id == podgorica);
        Assert.DoesNotContain(near!, p => p.Id == budva);
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

    private async Task<Guid> PublishedAtAsync(Actor host, double lat, double lng)
    {
        var body = new { title = "Somewhere", description = "d", price = 5, capacity = 10, startsAt = In(4), endsAt = In(9), latitude = lat, longitude = lng };
        var id = (await (await host.Http.PostAsJsonAsync("/api/parties", body)).Content.ReadFromJsonAsync<TestApp.IdBody>())!.Id;
        (await host.Http.PostAsync($"/api/parties/{id}/publish", null)).EnsureSuccessStatusCode();
        return id;
    }
}
