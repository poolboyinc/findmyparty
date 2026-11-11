using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FindMyParty.Api.Common;
using FindMyParty.Api.Venues;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace FindMyParty.Api.Tests;

[Collection("api")]
public class FollowTests(TestApp app)
{
    private Task<int> FollowRowsAsync(Guid userId, Guid venueId) =>
        app.WithDb(db => db.Set<VenueFollow>().CountAsync(f => f.UserId == userId && f.VenueId == venueId));

    private static async Task<Guid> DraftAsync(VenueTestHelpers.Alone at, decimal price = 5)
    {
        // Saturday 13 November 2027, 22:00 UTC = 23:00 in Podgorica.
        var starts = VenueTestHelpers.Utc(2027, 11, 13, 22);
        var created = await at.Host.Http.PostAsJsonAsync("/api/parties", VenueTestHelpers.PartyInput(at, starts, starts.AddHours(5), price: price));
        created.EnsureSuccessStatusCode();
        return (await created.Content.ReadFromJsonAsync<TestApp.IdBody>())!.Id;
    }

    [Fact]
    public async Task Following_twice_is_one_follow_and_the_venue_page_says_so()
    {
        var at = await app.HostAloneAsync();
        var guest = await app.UserAsync();

        var first = await guest.Http.PutAsync($"/api/venues/{at.VenueId}/follow", null);
        var second = await guest.Http.PutAsync($"/api/venues/{at.VenueId}/follow", null);

        Assert.Equal(HttpStatusCode.NoContent, first.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, second.StatusCode);
        Assert.Equal(1, await FollowRowsAsync(guest.Id, at.VenueId));
        Assert.True((await guest.Http.GetFromJsonAsync<JsonElement>($"/api/venues/{at.VenueId}")).GetProperty("following").GetBoolean());
        Assert.False((await app.CreateClient().GetFromJsonAsync<JsonElement>($"/api/venues/{at.VenueId}")).GetProperty("following").GetBoolean());
        Assert.False((await (await app.UserAsync()).Http.GetFromJsonAsync<JsonElement>($"/api/venues/{at.VenueId}")).GetProperty("following").GetBoolean());
        Assert.Equal(1, (await at.Host.Http.GetFromJsonAsync<JsonElement>("/api/hosts/profile")).GetProperty("followerCount").GetInt32());
    }

    [Fact]
    public async Task Unfollowing_twice_is_fine_and_leaves_no_follow()
    {
        var at = await app.HostAloneAsync();
        var guest = await app.UserAsync();
        await guest.Http.PutAsync($"/api/venues/{at.VenueId}/follow", null);

        var first = await guest.Http.DeleteAsync($"/api/venues/{at.VenueId}/follow");
        var second = await guest.Http.DeleteAsync($"/api/venues/{at.VenueId}/follow");

        Assert.Equal((HttpStatusCode.NoContent, HttpStatusCode.NoContent), (first.StatusCode, second.StatusCode));
        Assert.Equal(0, await FollowRowsAsync(guest.Id, at.VenueId));
    }

    [Fact]
    public async Task Following_needs_a_sign_in_and_a_venue_that_exists()
    {
        var at = await app.HostAloneAsync();

        Assert.Equal(HttpStatusCode.Unauthorized, (await app.CreateClient().PutAsync($"/api/venues/{at.VenueId}/follow", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await (await app.UserAsync()).Http.PutAsync($"/api/venues/{Guid.NewGuid()}/follow", null)).StatusCode);
    }

    [Fact]
    public async Task Publishing_a_party_tells_the_venues_followers_and_nobody_else()
    {
        var at = await app.HostAloneAsync();
        await at.Host.Http.PatchAsJsonAsync("/api/hosts/profile", new { venueName = "Monkey" });
        var follower = await app.UserAsync();
        var stranger = await app.UserAsync();
        await follower.Http.PutAsync($"/api/venues/{at.VenueId}/follow", null);
        var party = await DraftAsync(at);

        (await at.Host.Http.PostAsync($"/api/parties/{party}/publish", null)).EnsureSuccessStatusCode();

        var push = Assert.Single(app.Notifier.SentTo(follower.Id, "party_published"));
        Assert.Equal(NotifyCategory.Venues, push.Category);
        Assert.Equal("Monkey: Neon Friday", push.Title);
        Assert.Equal("Sat 13 Nov, 23:00, €5 at the door", push.Body);
        var data = JsonSerializer.SerializeToElement(push.Data, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        Assert.Equal(party, data.GetProperty("partyId").GetGuid());
        Assert.Equal(at.VenueId, data.GetProperty("venueId").GetGuid());
        Assert.Empty(app.Notifier.SentTo(stranger.Id));
        Assert.Empty(app.Notifier.SentTo(at.Host.Id));
    }

    [Fact]
    public async Task A_free_party_says_so_in_the_push()
    {
        var at = await app.HostAloneAsync();
        var follower = await app.UserAsync();
        await follower.Http.PutAsync($"/api/venues/{at.VenueId}/follow", null);
        var party = await DraftAsync(at, price: 0);

        (await at.Host.Http.PostAsync($"/api/parties/{party}/publish", null)).EnsureSuccessStatusCode();

        Assert.Equal("Sat 13 Nov, 23:00, free entry", Assert.Single(app.Notifier.SentTo(follower.Id, "party_published")).Body);
    }

    [Fact]
    public async Task After_unfollowing_a_new_party_sends_nothing()
    {
        var at = await app.HostAloneAsync();
        var guest = await app.UserAsync();
        await guest.Http.PutAsync($"/api/venues/{at.VenueId}/follow", null);
        await guest.Http.DeleteAsync($"/api/venues/{at.VenueId}/follow");
        var party = await DraftAsync(at);

        (await at.Host.Http.PostAsync($"/api/parties/{party}/publish", null)).EnsureSuccessStatusCode();

        Assert.Empty(app.Notifier.SentTo(guest.Id));
    }

    [Fact]
    public async Task Deleting_an_account_removes_its_follows()
    {
        var at = await app.HostAloneAsync();
        var guest = await app.UserAsync();
        await guest.Http.PutAsync($"/api/venues/{at.VenueId}/follow", null);

        (await guest.Http.DeleteAsync("/api/auth/account")).EnsureSuccessStatusCode();

        Assert.Equal(0, await FollowRowsAsync(guest.Id, at.VenueId));
    }

    [Fact]
    public async Task Deleting_a_hosts_account_removes_the_follows_of_their_venue()
    {
        var at = await app.HostAloneAsync();
        var guest = await app.UserAsync();
        await guest.Http.PutAsync($"/api/venues/{at.VenueId}/follow", null);

        (await at.Host.Http.DeleteAsync("/api/auth/account")).EnsureSuccessStatusCode();

        Assert.Equal(0, await FollowRowsAsync(guest.Id, at.VenueId));
    }
}
