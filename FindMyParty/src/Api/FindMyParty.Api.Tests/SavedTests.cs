using System.Net;
using System.Net.Http.Json;
using FindMyParty.Api.Me;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace FindMyParty.Api.Tests;

[Collection("api")]
public class SavedTests(TestApp app)
{
    private record SavedBody(List<Guid> Parties, List<Guid> Venues);

    private static async Task<SavedBody> SavedAsync(Actor actor)
    {
        var response = await actor.Http.GetAsync("/api/me/saved");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<SavedBody>())!;
    }

    private Task<int> RowsAsync(Guid userId) => app.WithDb(db => db.Set<SavedItem>().CountAsync(s => s.UserId == userId));

    private async Task<(Guid Party, Guid Venue)> PartyAndVenueAsync()
    {
        var host = await app.HostAsync();
        var party = await app.PublishedPartyAsync(host);
        var hostId = host.Id.ToString();
        var venue = await app.WithDb(db => db.VenueProfiles.Where(v => v.UserId == hostId).Select(v => v.Id).SingleAsync());
        return (party, venue);
    }

    [Fact]
    public async Task Saved_needs_a_token()
    {
        var http = app.CreateClient();

        Assert.Equal(HttpStatusCode.Unauthorized, (await http.GetAsync("/api/me/saved")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await http.PutAsync($"/api/me/saved/party/{Guid.NewGuid()}", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await http.PostAsJsonAsync("/api/me/saved/import", new { parties = Array.Empty<string>() })).StatusCode);
    }

    [Fact]
    public async Task A_new_account_has_nothing_saved()
    {
        var user = await app.UserAsync();

        var saved = await SavedAsync(user);

        Assert.Empty(saved.Parties);
        Assert.Empty(saved.Venues);
    }

    [Fact]
    public async Task Saving_twice_keeps_one_row_and_unsaving_twice_is_fine()
    {
        var (party, venue) = await PartyAndVenueAsync();
        var user = await app.UserAsync();

        Assert.Equal(HttpStatusCode.NoContent, (await user.Http.PutAsync($"/api/me/saved/party/{party}", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await user.Http.PutAsync($"/api/me/saved/party/{party}", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await user.Http.PutAsync($"/api/me/saved/venue/{venue}", null)).StatusCode);

        var saved = await SavedAsync(user);
        Assert.Equal([party], saved.Parties);
        Assert.Equal([venue], saved.Venues);
        Assert.Equal(2, await RowsAsync(user.Id));

        Assert.Equal(HttpStatusCode.NoContent, (await user.Http.DeleteAsync($"/api/me/saved/party/{party}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await user.Http.DeleteAsync($"/api/me/saved/party/{party}")).StatusCode);

        saved = await SavedAsync(user);
        Assert.Empty(saved.Parties);
        Assert.Equal([venue], saved.Venues);
    }

    [Fact]
    public async Task Saving_at_the_same_moment_twice_keeps_one_row()
    {
        var (party, _) = await PartyAndVenueAsync();
        var user = await app.UserAsync();

        var answers = await Task.WhenAll(Enumerable.Range(0, 6).Select(_ => user.Http.PutAsync($"/api/me/saved/party/{party}", null)));

        Assert.All(answers, a => Assert.Equal(HttpStatusCode.NoContent, a.StatusCode));
        Assert.Equal(1, await RowsAsync(user.Id));
    }

    [Fact]
    public async Task Saved_items_belong_to_their_user()
    {
        var (party, _) = await PartyAndVenueAsync();
        var mila = await app.UserAsync();
        var luka = await app.UserAsync();

        await mila.Http.PutAsync($"/api/me/saved/party/{party}", null);

        Assert.Empty((await SavedAsync(luka)).Parties);
        Assert.Equal([party], (await SavedAsync(mila)).Parties);
    }

    [Fact]
    public async Task An_unknown_target_or_kind_is_not_found()
    {
        var (party, venue) = await PartyAndVenueAsync();
        var user = await app.UserAsync();
        var draft = await app.DraftPartyAsync(await app.HostAsync());

        Assert.Equal(HttpStatusCode.NotFound, (await user.Http.PutAsync($"/api/me/saved/party/{Guid.NewGuid()}", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await user.Http.PutAsync($"/api/me/saved/venue/{Guid.NewGuid()}", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await user.Http.PutAsync($"/api/me/saved/party/{venue}", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await user.Http.PutAsync($"/api/me/saved/venue/{party}", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await user.Http.PutAsync($"/api/me/saved/party/{draft}", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await user.Http.PutAsync($"/api/me/saved/song/{party}", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await user.Http.DeleteAsync($"/api/me/saved/party/{Guid.NewGuid()}")).StatusCode);
        Assert.Equal(0, await RowsAsync(user.Id));
    }

    [Fact]
    public async Task A_party_that_was_deleted_drops_out_and_can_still_be_unsaved()
    {
        var host = await app.HostAsync();
        var party = await app.PublishedPartyAsync(host);
        var user = await app.UserAsync();
        await user.Http.PutAsync($"/api/me/saved/party/{party}", null);
        await app.WithDb(db => db.Parties.Where(p => p.Id == party).ExecuteUpdateAsync(s => s.SetProperty(p => p.IsDeleted, true)));

        Assert.Empty((await SavedAsync(user)).Parties);
        Assert.Equal(HttpStatusCode.NoContent, (await user.Http.DeleteAsync($"/api/me/saved/party/{party}")).StatusCode);
        Assert.Equal(0, await RowsAsync(user.Id));
    }

    [Fact]
    public async Task Import_adds_what_exists_and_skips_unknown_ids()
    {
        var (party, venue) = await PartyAndVenueAsync();
        var (other, _) = await PartyAndVenueAsync();
        var user = await app.UserAsync();
        await user.Http.PutAsync($"/api/me/saved/party/{other}", null);

        var response = await user.Http.PostAsJsonAsync("/api/me/saved/import", new
        {
            parties = new[] { party.ToString(), Guid.NewGuid().ToString(), "not-an-id", party.ToString(), other.ToString(), venue.ToString() },
            venues = new[] { venue.ToString(), party.ToString() },
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var saved = (await response.Content.ReadFromJsonAsync<SavedBody>())!;
        Assert.Equal([other, party], saved.Parties);
        Assert.Equal([venue], saved.Venues);
        Assert.Equal(3, await RowsAsync(user.Id));
    }

    [Fact]
    public async Task Import_without_venues_is_fine()
    {
        var (party, _) = await PartyAndVenueAsync();
        var user = await app.UserAsync();

        var response = await user.Http.PostAsJsonAsync("/api/me/saved/import", new { parties = new[] { party.ToString() } });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal([party], (await response.Content.ReadFromJsonAsync<SavedBody>())!.Parties);
    }

    [Fact]
    public async Task Import_takes_at_most_200_of_each()
    {
        var user = await app.UserAsync();
        var many = Enumerable.Range(0, 201).Select(_ => Guid.NewGuid().ToString()).ToArray();

        var response = await user.Http.PostAsJsonAsync("/api/me/saved/import", new { parties = many });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Deleting_the_account_removes_its_saved_items()
    {
        var (party, venue) = await PartyAndVenueAsync();
        var user = await app.UserAsync();
        await user.Http.PutAsync($"/api/me/saved/party/{party}", null);
        await user.Http.PutAsync($"/api/me/saved/venue/{venue}", null);

        (await user.Http.DeleteAsync("/api/auth/account")).EnsureSuccessStatusCode();

        Assert.Equal(0, await RowsAsync(user.Id));
    }

    [Fact]
    public async Task Deleting_a_host_account_removes_their_venue_from_everyone_s_saved_items()
    {
        var host = await app.HostAsync();
        var hostId = host.Id.ToString();
        var venue = await app.WithDb(db => db.VenueProfiles.Where(v => v.UserId == hostId).Select(v => v.Id).SingleAsync());
        var fan = await app.UserAsync();
        await fan.Http.PutAsync($"/api/me/saved/venue/{venue}", null);

        (await host.Http.DeleteAsync("/api/auth/account")).EnsureSuccessStatusCode();

        Assert.Empty((await SavedAsync(fan)).Venues);
        Assert.Equal(0, await RowsAsync(fan.Id));
    }
}
