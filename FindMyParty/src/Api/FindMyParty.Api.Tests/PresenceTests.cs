using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FindMyParty.Api.Bookings;
using FindMyParty.Api.Friends;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace FindMyParty.Api.Tests;

/// <summary>
/// Who sees which friend where. Every test checks the friends layer and the `friendsHere` on parties and venues,
/// because a friend must never show up in one place while the rules hide them in another.
/// </summary>
[Collection("api")]
public class PresenceTests(TestApp app)
{
    private record Party(Guid Venue, Guid Id);

    private static async Task<FriendsOutResponse> LayerAsync(Actor viewer, string city = "podgorica") =>
        (await viewer.Http.GetFromJsonAsync<FriendsOutResponse>($"/api/friends/out?city={city}"))!;

    /// <summary>`friendsHere` on the party detail, the venue page, and the party and venue rows of the lists (null where absent).</summary>
    private async Task<JsonElement?[]> HereEverywhereAsync(HttpClient http, Party party)
    {
        var spot = await app.WithDb(db => db.VenueProfiles.Where(v => v.Id == party.Venue).Select(v => new { v.Latitude, v.Longitude }).SingleAsync());
        var near = string.Create(CultureInfo.InvariantCulture, $"lat={spot.Latitude}&lng={spot.Longitude}&radiusKm=1&pageSize=100");

        var detail = await http.GetFromJsonAsync<JsonElement>($"/api/parties/{party.Id}");
        var venue = await http.GetFromJsonAsync<JsonElement>($"/api/venues/{party.Venue}");
        // An ended party has left the feed (the feed follows the server's clock): it then shows nobody, as it should.
        var feedRows = (await http.GetFromJsonAsync<JsonElement>($"/api/parties?{near}")).EnumerateArray().Where(p => p.GetProperty("id").GetGuid() == party.Id).ToList();
        var venueRow = (await http.GetFromJsonAsync<JsonElement>($"/api/venues?{near}")).EnumerateArray().Single(v => v.GetProperty("id").GetGuid() == party.Venue);
        Assert.True(feedRows.Count <= 1);
        return new JsonElement?[] { detail, venue, feedRows.Count == 1 ? feedRows[0] : null, venueRow }
            .Select(json => json is { } row && row.TryGetProperty("friendsHere", out var here) ? here : (JsonElement?)null).ToArray();
    }

    private async Task AssertNowhereAsync(Actor viewer, Party party, string city = "podgorica")
    {
        var layer = await LayerAsync(viewer, city);
        Assert.Equal(0, layer.FriendsOut);
        Assert.Empty(layer.Venues);
        Assert.Null(layer.Headline);
        Assert.All(await HereEverywhereAsync(viewer.Http, party), Assert.Null);
    }

    private async Task<Party> PartyAsync(string venueName = "Monkey", string city = "podgorica", TimeSpan? endsIn = null)
    {
        var (venue, party, _) = await app.RunningPartyAsync(venueName, city, endsIn: endsIn);
        return new Party(venue, party);
    }

    /// <summary>A viewer who shares, and a friend of theirs who shares too. Nobody is anywhere yet.</summary>
    private async Task<(Actor Viewer, Actor Friend)> SharingFriendsAsync(string friendName = "Mila Perić")
    {
        var viewer = await app.PersonAsync("Vule Marković");
        var friend = await app.PersonAsync(friendName);
        await viewer.BefriendAsync(friend);
        await viewer.ShareAsync();
        await friend.ShareAsync();
        return (viewer, friend);
    }

    [Fact]
    public async Task A_friend_scanned_in_is_seen_at_that_venue_on_the_layer_and_on_all_four_responses()
    {
        var (vule, mila) = await SharingFriendsAsync();
        var monkey = await PartyAsync("Monkey");
        await AssertNowhereAsync(vule, monkey);

        await app.ScanInAsync(monkey.Id, mila.Id);

        var layer = await LayerAsync(vule);
        Assert.True(layer.Sharing);
        Assert.Equal(1, layer.FriendsOut);
        var venue = Assert.Single(layer.Venues);
        Assert.Equal((monkey.Venue, "Monkey", 1), (venue.VenueId, venue.VenueName, venue.Count));
        Assert.Equal((mila.Id, "Mila Perić", "M"), (venue.Friends[0].UserId, venue.Friends[0].DisplayName, venue.Friends[0].Initial));
        Assert.Equal(new FriendsHeadline("Mila", 0, "Monkey"), layer.Headline);
        Assert.All(await HereEverywhereAsync(vule.Http, monkey), here =>
        {
            Assert.NotNull(here);
            Assert.Equal(1, here.Value.GetProperty("count").GetInt32());
            Assert.Equal(["Mila"], here.Value.GetProperty("names").EnumerateArray().Select(n => n.GetString()));
            Assert.Equal(["M"], here.Value.GetProperty("initials").EnumerateArray().Select(n => n.GetString()));
        });
    }

    [Fact]
    public async Task A_real_door_scan_puts_the_friend_on_the_map_and_only_once_it_has_happened()
    {
        var (vule, mila) = await SharingFriendsAsync();
        var host = await app.HostAsync();
        var partyId = await app.PublishedPartyAsync(host);
        var venueId = (await host.Http.GetFromJsonAsync<JsonElement>($"/api/parties/{partyId}")).GetProperty("venueId").GetGuid();
        var booking = await mila.BookedAsync(partyId);
        var startsAt = await app.WithDb(db => db.Parties.Where(p => p.Id == partyId).Select(p => p.StartsAt).SingleAsync());

        using (app.Clock.At(startsAt.AddMinutes(30)))
            Assert.DoesNotContain((await LayerAsync(vule)).Venues, v => v.VenueId == venueId); // a pass is not a scan

        var pass = (await mila.Http.GetFromJsonAsync<JsonElement>($"/api/bookings/{booking}/pass"));
        var code = PassCode.Format(booking, PassCode.Compute(pass.GetProperty("secret").GetString()!, PassCode.StepAt(DateTime.UtcNow)));
        (await host.Http.PostAsJsonAsync("/api/checkins", new { code })).EnsureSuccessStatusCode();

        using (app.Clock.At(startsAt.AddMinutes(30)))
        {
            var venue = Assert.Single((await LayerAsync(vule)).Venues);
            Assert.Equal(venueId, venue.VenueId);
            Assert.Equal(mila.Id, venue.Friends.Single().UserId);
        }
    }

    [Fact]
    public async Task A_friend_is_not_seen_before_the_moment_of_their_scan()
    {
        var (vule, mila) = await SharingFriendsAsync();
        var monkey = await PartyAsync(); // started an hour ago
        await app.ScanInAsync(monkey.Id, mila.Id, TimeSpan.FromMinutes(5));

        using var _ = app.Clock.At(app.Clock.UtcNow.AddMinutes(-30));

        await AssertNowhereAsync(vule, monkey);
    }

    [Fact]
    public async Task A_friend_disappears_when_the_party_ends()
    {
        var (vule, mila) = await SharingFriendsAsync();
        var monkey = await PartyAsync(endsIn: TimeSpan.FromHours(2));
        await app.ScanInAsync(monkey.Id, mila.Id);
        Assert.Single((await LayerAsync(vule)).Venues);

        using var _ = app.Clock.At(app.Clock.UtcNow.AddHours(2).AddMinutes(1));

        await AssertNowhereAsync(vule, monkey);
    }

    [Fact]
    public async Task A_viewer_who_does_not_share_sees_nobody()
    {
        var (vule, mila) = await SharingFriendsAsync();
        var monkey = await PartyAsync();
        await app.ScanInAsync(monkey.Id, mila.Id);

        await vule.PrivacyAsync(share: false);

        var layer = await LayerAsync(vule);
        Assert.False(layer.Sharing);
        await AssertNowhereAsync(vule, monkey);
        Assert.False((await vule.FriendsOfAsync()).Sharing);
    }

    [Fact]
    public async Task A_friend_who_does_not_share_is_not_seen()
    {
        var (vule, mila) = await SharingFriendsAsync();
        var monkey = await PartyAsync();
        await app.ScanInAsync(monkey.Id, mila.Id);

        await mila.PrivacyAsync(share: false);

        await AssertNowhereAsync(vule, monkey);
    }

    [Fact]
    public async Task An_invisible_friend_is_not_seen_until_noon_the_next_day()
    {
        var (vule, mila) = await SharingFriendsAsync();
        var monkey = await PartyAsync(endsIn: TimeSpan.FromDays(3));
        await app.ScanInAsync(monkey.Id, mila.Id);

        var state = await mila.PrivacyAsync(invisible: true);

        Assert.True(state.ShareWithFriends);
        Assert.NotNull(state.InvisibleUntil);
        await AssertNowhereAsync(vule, monkey);

        using var _ = app.Clock.At(state.InvisibleUntil!.Value.AddMinutes(1));
        Assert.Equal(mila.Id, Assert.Single((await LayerAsync(vule)).Venues).Friends.Single().UserId);
        Assert.Null((await mila.FriendsOfAsync()).InvisibleUntil); // over: reads as not invisible
    }

    [Fact]
    public async Task Switching_invisible_off_shows_the_friend_again()
    {
        var (vule, mila) = await SharingFriendsAsync();
        var monkey = await PartyAsync();
        await app.ScanInAsync(monkey.Id, mila.Id);
        await mila.PrivacyAsync(invisible: true);

        var state = await mila.PrivacyAsync(invisible: false);

        Assert.Null(state.InvisibleUntil);
        Assert.Single((await LayerAsync(vule)).Venues);
    }

    [Theory]
    [InlineData("2026-11-13T22:30:00Z", null, "2026-11-14T11:00:00Z")]        // Friday 23:30 → Saturday 12:00 (winter, UTC+1)
    [InlineData("2026-11-14T00:30:00Z", "budva", "2026-11-14T11:00:00Z")]     // 01:30 on Saturday is still Friday's night
    [InlineData("2026-11-14T09:00:00Z", "podgorica", "2026-11-15T11:00:00Z")] // Saturday 10:00: tonight is Saturday's night
    [InlineData("2026-07-03T21:00:00Z", null, "2026-07-04T10:00:00Z")]        // summer, UTC+2
    public async Task Invisible_tonight_lasts_until_noon_the_next_day_in_the_home_city(string now, string? homeCity, string until)
    {
        var mila = await app.PersonAsync();
        await app.EditUserAsync(mila.Id, u => u.HomeCity = homeCity);
        using var _ = app.Clock.At(DateTime.Parse(now, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal));

        var state = await mila.PrivacyAsync(invisible: true);

        Assert.Equal(DateTime.Parse(until, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal), state.InvisibleUntil!.Value.ToUniversalTime());
    }

    [Fact]
    public async Task A_suspended_friend_is_not_seen_and_a_suspended_viewer_sees_nobody()
    {
        var (vule, mila) = await SharingFriendsAsync();
        var (ana, luka) = await SharingFriendsAsync("Luka Vuković");
        var monkey = await PartyAsync();
        var kula = await PartyAsync("Kula");
        await app.ScanInAsync(monkey.Id, mila.Id);
        await app.ScanInAsync(kula.Id, luka.Id);

        await app.EditUserAsync(mila.Id, u => u.SharingSuspended = true); // her switch is still on
        await app.EditUserAsync(ana.Id, u => u.SharingSuspended = true);

        await AssertNowhereAsync(vule, monkey);
        var anasLayer = await LayerAsync(ana);
        Assert.False(anasLayer.Sharing);
        await AssertNowhereAsync(ana, kula);
    }

    [Fact]
    public async Task A_suspended_account_cannot_switch_sharing_on()
    {
        var mila = await app.PersonAsync();
        await app.EditUserAsync(mila.Id, u => u.SharingSuspended = true);

        var response = await mila.Http.PatchAsJsonAsync("/api/me/privacy", new { shareWithFriends = true });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("sharing_suspended", (await response.ProblemAsync()).Code);
        Assert.False((await app.ReadUserAsync(mila.Id)).ShareWithFriends);
        Assert.Equal(HttpStatusCode.OK, (await mila.Http.PatchAsJsonAsync("/api/me/privacy", new { shareWithFriends = false })).StatusCode);
    }

    [Fact]
    public async Task Someone_who_is_not_an_accepted_friend_is_never_seen()
    {
        var vule = await app.PersonAsync();
        var asked = await app.PersonAsync();
        var asker = await app.PersonAsync();
        var stranger = await app.PersonAsync();
        foreach (var a in new[] { vule, asked, asker, stranger }) await a.ShareAsync();
        (await vule.AskAsync(asked)).EnsureSuccessStatusCode();
        (await asker.AskAsync(vule)).EnsureSuccessStatusCode();
        var monkey = await PartyAsync();
        foreach (var a in new[] { asked, asker, stranger }) await app.ScanInAsync(monkey.Id, a.Id);

        await AssertNowhereAsync(vule, monkey);
        await AssertNowhereAsync(asked, monkey); // and the other way round
    }

    [Fact]
    public async Task A_block_hides_both_from_each_other_even_if_a_friendship_row_survived()
    {
        var (vule, mila) = await SharingFriendsAsync();
        var monkey = await PartyAsync();
        await app.ScanInAsync(monkey.Id, mila.Id);
        await app.ScanInAsync(monkey.Id, vule.Id);
        // A block written beside a friendship, as a race between "accept" and "block" could leave it.
        await app.WithDb(async db =>
        {
            db.Set<UserBlock>().Add(new UserBlock { BlockerId = mila.Id, BlockedId = vule.Id, CreatedAt = DateTime.UtcNow });
            return await db.SaveChangesAsync();
        });

        await AssertNowhereAsync(vule, monkey);
        await AssertNowhereAsync(mila, monkey);
    }

    [Fact]
    public async Task Signed_out_callers_get_no_friendsHere()
    {
        var (_, mila) = await SharingFriendsAsync();
        var monkey = await PartyAsync();
        await app.ScanInAsync(monkey.Id, mila.Id);

        Assert.All(await HereEverywhereAsync(app.CreateClient(), monkey), Assert.Null);
    }

    [Fact]
    public async Task Each_friend_shows_at_the_venue_of_their_latest_scan_only()
    {
        var (vule, mila) = await SharingFriendsAsync();
        var monkey = await PartyAsync("Monkey");
        var kula = await PartyAsync("Kula");
        await app.ScanInAsync(monkey.Id, mila.Id, TimeSpan.FromMinutes(50));
        await app.ScanInAsync(kula.Id, mila.Id, TimeSpan.FromMinutes(5));

        var layer = await LayerAsync(vule);

        Assert.Equal(1, layer.FriendsOut);
        Assert.Equal(kula.Venue, Assert.Single(layer.Venues).VenueId);
        Assert.All(await HereEverywhereAsync(vule.Http, monkey), Assert.Null);
        Assert.All(await HereEverywhereAsync(vule.Http, kula), here => Assert.True(here.HasValue));
    }

    [Fact]
    public async Task The_headline_names_the_first_in_at_the_fullest_venue_and_the_counts_stay_within_bounds()
    {
        var vule = await app.PersonAsync("Vule");
        await vule.ShareAsync();
        var drHouse = await PartyAsync("Dr. House");
        var blok = await PartyAsync("Blok 5");
        var names = new[] { "Mila Perić", "Ana Radović", "Sara Kovač", "Jovana Ilić" };
        for (var i = 0; i < names.Length; i++)
        {
            var friend = await app.PersonAsync(names[i]);
            await vule.BefriendAsync(friend);
            await friend.ShareAsync();
            await app.ScanInAsync(drHouse.Id, friend.Id, TimeSpan.FromMinutes(40 - i)); // Mila first
        }
        var dino = await app.PersonAsync("Dino Hadžić");
        await vule.BefriendAsync(dino);
        await dino.ShareAsync();
        await app.ScanInAsync(blok.Id, dino.Id, TimeSpan.FromMinutes(60));

        var layer = await LayerAsync(vule);
        var here = (await HereEverywhereAsync(vule.Http, drHouse))[0]!.Value;

        Assert.Equal(5, layer.FriendsOut);
        Assert.Equal(new FriendsHeadline("Mila", 3, "Dr. House"), layer.Headline);
        Assert.Equal(["Dr. House", "Blok 5"], layer.Venues.Select(v => v.VenueName));
        Assert.Equal(4, layer.Venues[0].Count);
        Assert.Equal(["M", "A", "S"], layer.Venues[0].Friends.Select(f => f.Initial)); // three at most
        Assert.Equal(4, here.GetProperty("count").GetInt32());
        Assert.Equal(["Mila", "Ana"], here.GetProperty("names").EnumerateArray().Select(n => n.GetString()));
        Assert.Equal(["M", "A", "S"], here.GetProperty("initials").EnumerateArray().Select(n => n.GetString()));
    }

    [Fact]
    public async Task The_layer_is_for_one_city_and_an_unknown_city_is_refused()
    {
        var (vule, mila) = await SharingFriendsAsync();
        var budva = await PartyAsync("Top Hill", city: "budva");
        await app.ScanInAsync(budva.Id, mila.Id);

        var podgorica = await LayerAsync(vule);
        var there = await LayerAsync(vule, "budva");
        var unknown = await vule.Http.GetAsync("/api/friends/out?city=atlantis");
        await app.EditUserAsync(vule.Id, u => u.HomeCity = "budva");
        var home = (await vule.Http.GetFromJsonAsync<FriendsOutResponse>("/api/friends/out"))!;

        Assert.Equal((0, 1, 1), (podgorica.FriendsOut, there.FriendsOut, home.FriendsOut));
        Assert.Equal((HttpStatusCode.BadRequest, "city_unknown"), (unknown.StatusCode, (await unknown.ProblemAsync()).Code));
    }

    [Fact]
    public async Task A_scan_on_a_cancelled_party_shows_nobody()
    {
        var (vule, mila) = await SharingFriendsAsync();
        var monkey = await PartyAsync();
        await app.ScanInAsync(monkey.Id, mila.Id);

        await app.WithDb(db => db.Parties.Where(p => p.Id == monkey.Id)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Status, FindMyParty.Api.Parties.PartyStatus.Cancelled)));

        Assert.Empty((await LayerAsync(vule)).Venues);
    }

    // ── the demo ──

    [Fact]
    public async Task The_demo_owner_has_five_friends_out_and_a_request_waiting_once_they_switch_sharing_on()
    {
        var database = "friends_" + Guid.NewGuid().ToString("N")[..10];
        var email = $"owner-{Guid.NewGuid():N}@example.test";
        var settings = new Dictionary<string, string?>
        {
            ["ConnectionStrings:DefaultConnection"] = app.ConnectionStringFor(database),
            ["Seed:Demo"] = "true",
            ["Seed:OwnerEmail"] = email,
        };
        using (var first = app.With(settings))
            (await first.CreateClient().PostAsJsonAsync("/api/auth/register",
                new { userName = "owner" + Guid.NewGuid().ToString("N")[..8], email, password = Actor.DefaultPassword })).EnsureSuccessStatusCode();

        using var seeded = app.With(settings); // starts again: now the owner exists
        var login = await seeded.CreateClient().PostAsJsonAsync("/api/auth/login", new { email, password = Actor.DefaultPassword });
        var tokens = (await login.Content.ReadFromJsonAsync<FindMyParty.Api.Identity.LoginResponse>())!;
        var http = seeded.CreateClient();
        http.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", tokens.AccessToken);

        var before = (await http.GetFromJsonAsync<FriendsOutResponse>("/api/friends/out?city=podgorica"))!;
        var list = (await http.GetFromJsonAsync<FriendsList>("/api/friends"))!;
        (await http.PatchAsJsonAsync("/api/me/privacy", new { shareWithFriends = true })).EnsureSuccessStatusCode();
        var layer = (await http.GetFromJsonAsync<FriendsOutResponse>("/api/friends/out?city=podgorica"))!;

        Assert.False(before.Sharing); // the owner's switch is left off, as drawn
        Assert.Equal(["Ana Radović", "Dino Hadžić", "Luka Vuković", "Mila Perić", "Sara Kovač"], list.Friends.Select(f => f.DisplayName));
        Assert.Equal("Jovana Ilić", Assert.Single(list.Incoming).User.DisplayName);
        Assert.Equal(5, layer.FriendsOut);
        Assert.Equal(new FriendsHeadline("Mila", 2, "Monkey"), layer.Headline);
        Assert.Equal([("Monkey", 3), ("Blok 5", 1), ("Dr. House", 1)], layer.Venues.Select(v => (v.VenueName, v.Count)));

        // The seed runs every half hour: nothing doubles, and it does not put back what the owner blocked.
        using var scope = seeded.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<FindMyParty.Api.Data.AppDbContext>();
        var counts = async () => (await db.Bookings.CountAsync(), await db.CheckIns.CountAsync(), await db.Set<Friendship>().CountAsync());
        var once = await counts();
        var jovana = list.Incoming.Single().User.UserId;
        (await http.PutAsync($"/api/users/{jovana}/block", null)).EnsureSuccessStatusCode();
        await scope.ServiceProvider.GetRequiredService<FindMyParty.Api.Demo.DemoSeeder>().EnsureAsync(email);
        Assert.Equal((once.Item1, once.Item2, once.Item3 - 1), await counts());
    }
}
