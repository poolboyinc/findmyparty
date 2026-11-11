using System.Net;
using System.Net.Http.Json;
using FindMyParty.Api.Bookings;
using FindMyParty.Api.Friends;
using FindMyParty.Api.Identity;
using FindMyParty.Api.Parties;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace FindMyParty.Api.Tests;

/// <summary>Helpers for the friends tests (FriendTests, PresenceTests, ReportTests).</summary>
public static class FriendsKit
{
    public record Problem(string Title, string Code);

    /// <summary>A new account with this shown name (and a unique user name).</summary>
    public static async Task<Actor> PersonAsync(this TestApp app, string? displayName = null)
    {
        var actor = await app.UserAsync();
        if (displayName is not null) await app.EditUserAsync(actor.Id, u => u.DisplayName = displayName);
        return actor;
    }

    public static Task EditUserAsync(this TestApp app, Guid id, Action<ApplicationUser> edit) => app.WithDb(async db =>
    {
        var key = id.ToString();
        var user = await db.Users.SingleAsync(u => u.Id == key);
        edit(user);
        return await db.SaveChangesAsync();
    });

    public static Task<ApplicationUser> ReadUserAsync(this TestApp app, Guid id) => app.WithDb(db =>
    {
        var key = id.ToString();
        return db.Users.AsNoTracking().SingleAsync(u => u.Id == key);
    });

    public static async Task<string> UserNameAsync(this TestApp app, Actor actor) => (await app.ReadUserAsync(actor.Id)).UserName!;

    public static Task<HttpResponseMessage> AskAsync(this Actor me, Actor other) =>
        me.Http.PostAsJsonAsync("/api/friends/requests", new { userId = other.Id });

    public static async Task<FriendsList> FriendsOfAsync(this Actor me) => (await me.Http.GetFromJsonAsync<FriendsList>("/api/friends"))!;

    /// <summary>Makes the two friends through the API: a asks, b accepts.</summary>
    public static async Task BefriendAsync(this Actor a, Actor b)
    {
        (await a.AskAsync(b)).EnsureSuccessStatusCode();
        var request = (await b.FriendsOfAsync()).Incoming.Single(r => r.User.UserId == a.Id);
        (await b.Http.PostAsync($"/api/friends/requests/{request.Id}/accept", null)).EnsureSuccessStatusCode();
    }

    public static async Task<PrivacyState> PrivacyAsync(this Actor me, bool? share = null, bool? invisible = null)
    {
        var response = await me.Http.PatchAsJsonAsync("/api/me/privacy", new { shareWithFriends = share, invisibleTonight = invisible });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<PrivacyState>())!;
    }

    public static Task<PrivacyState> ShareAsync(this Actor me) => me.PrivacyAsync(share: true);

    /// <summary>
    /// A venue of its own (on a spot nothing else is near, in this city) with a published party that runs from
    /// `startedAgo` before now until `endsIn` after now. Made straight in the database: the API will not publish a party that has begun.
    /// </summary>
    public static async Task<(Guid Venue, Guid Party, Guid HostId)> RunningPartyAsync(this TestApp app, string venueName = "Test venue",
        string city = "podgorica", TimeSpan? startedAgo = null, TimeSpan? endsIn = null)
    {
        var (lat, lng) = TestApp.NewSpot();
        var host = await app.HostAsync();
        var now = app.Clock.UtcNow;
        return await app.WithDb(async db =>
        {
            var hostKey = host.Id.ToString();
            var venue = await db.VenueProfiles.SingleAsync(v => v.UserId == hostKey);
            venue.VenueName = venueName;
            venue.CitySlug = city;
            venue.Latitude = lat;
            venue.Longitude = lng;
            var party = new Party(host.Id, venue.Id, new PartyRequest
            {
                Title = venueName + " night", Description = "", Price = 5, Capacity = 100,
                StartsAt = now - (startedAgo ?? TimeSpan.FromHours(1)), EndsAt = now + (endsIn ?? TimeSpan.FromHours(4)),
                Latitude = lat, Longitude = lng, Genre = "Techno",
            });
            db.Parties.Add(party);
            db.Entry(party).Property(p => p.Status).CurrentValue = PartyStatus.Published;
            await db.SaveChangesAsync();
            return (venue.Id, party.Id, host.Id);
        });
    }

    /// <summary>The guest was scanned in at this party (a one-guest booking and its check-in), `ago` before now.</summary>
    public static Task ScanInAsync(this TestApp app, Guid partyId, Guid guestId, TimeSpan? ago = null) => app.WithDb(async db =>
    {
        var party = await db.Parties.SingleAsync(p => p.Id == partyId);
        var at = app.Clock.UtcNow - (ago ?? TimeSpan.FromMinutes(10));
        var booking = new Booking(guestId, partyId, 1, party.Price, Guid.NewGuid().ToString(), party.EndsAt);
        db.Bookings.Add(booking);
        db.Entry(booking).Property(b => b.CheckedInCount).CurrentValue = 1;
        db.Entry(booking).Property(b => b.FirstCheckedInAt).CurrentValue = at;
        db.Entry(booking).Property(b => b.Status).CurrentValue = BookingStatus.Confirmed;
        db.CheckIns.Add(new CheckIn { Id = Guid.NewGuid(), BookingId = booking.Id, PartyId = partyId, Admitted = 1, At = at, ByUserId = party.HostId, GuestUserId = guestId });
        return await db.SaveChangesAsync();
    });

    public static async Task AddRoleAsync(this TestApp app, Guid userId, string role)
    {
        using var scope = app.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = await users.FindByIdAsync(userId.ToString());
        await users.AddToRoleAsync(user!, role);
    }
}

/// <summary>The friend graph: asking, answering, removing, searching, blocking.</summary>
[Collection("api")]
public class FriendTests(TestApp app)
{
    [Fact]
    public async Task A_request_waits_until_the_other_accepts_and_each_side_is_told()
    {
        var vule = await app.PersonAsync("Vule Marković");
        var mila = await app.PersonAsync("Mila Perić");

        Assert.Equal(HttpStatusCode.NoContent, (await vule.AskAsync(mila)).StatusCode);

        var asked = await mila.FriendsOfAsync();
        var waiting = Assert.Single(asked.Incoming);
        Assert.Equal((vule.Id, Relation.Incoming, waiting.Id), (waiting.User.UserId, waiting.User.Relation, waiting.User.RequestId));
        Assert.Empty(asked.Friends);
        var mine = Assert.Single((await vule.FriendsOfAsync()).Outgoing);
        Assert.Equal((mila.Id, Relation.Requested), (mine.User.UserId, mine.User.Relation));
        var pushed = Assert.Single(app.Notifier.SentTo(mila.Id, "friend_request"));
        Assert.Equal("Vule wants to be friends", pushed.Title);
        Assert.Equal(FindMyParty.Api.Common.NotifyCategory.Friends, pushed.Category);

        (await mila.Http.PostAsync($"/api/friends/requests/{waiting.Id}/accept", null)).EnsureSuccessStatusCode();

        var friend = Assert.Single((await vule.FriendsOfAsync()).Friends);
        Assert.Equal((mila.Id, "Mila Perić", "M", "Spark"), (friend.UserId, friend.DisplayName, friend.Initial, friend.LevelName));
        Assert.Equal(vule.Id, Assert.Single((await mila.FriendsOfAsync()).Friends).UserId);
        Assert.Empty((await mila.FriendsOfAsync()).Incoming);
        Assert.Equal("Mila is now your friend", Assert.Single(app.Notifier.SentTo(vule.Id, "friend_accepted")).Title);
    }

    [Fact]
    public async Task Only_the_one_asked_can_accept()
    {
        var (vule, mila, stranger) = (await app.PersonAsync(), await app.PersonAsync(), await app.PersonAsync());
        (await vule.AskAsync(mila)).EnsureSuccessStatusCode();
        var request = (await vule.FriendsOfAsync()).Outgoing.Single();

        Assert.Equal(HttpStatusCode.NotFound, (await vule.Http.PostAsync($"/api/friends/requests/{request.Id}/accept", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.Http.PostAsync($"/api/friends/requests/{request.Id}/accept", null)).StatusCode);
        Assert.Empty((await vule.FriendsOfAsync()).Friends);
    }

    [Fact]
    public async Task Decline_withdraw_and_unfriend_each_remove_the_edge()
    {
        var (vule, mila, luka, ana) = (await app.PersonAsync(), await app.PersonAsync(), await app.PersonAsync(), await app.PersonAsync());

        (await vule.AskAsync(mila)).EnsureSuccessStatusCode();
        (await mila.Http.DeleteAsync($"/api/friends/{vule.Id}")).EnsureSuccessStatusCode(); // decline
        (await vule.AskAsync(luka)).EnsureSuccessStatusCode();
        (await vule.Http.DeleteAsync($"/api/friends/{luka.Id}")).EnsureSuccessStatusCode(); // withdraw
        await vule.BefriendAsync(ana);
        (await ana.Http.DeleteAsync($"/api/friends/{vule.Id}")).EnsureSuccessStatusCode(); // unfriend

        var list = await vule.FriendsOfAsync();
        Assert.Empty(list.Friends);
        Assert.Empty(list.Outgoing);
        Assert.Empty((await mila.FriendsOfAsync()).Incoming);
        Assert.Empty((await luka.FriendsOfAsync()).Incoming);
        Assert.Empty((await ana.FriendsOfAsync()).Friends);
        Assert.Equal(HttpStatusCode.NoContent, (await vule.Http.DeleteAsync($"/api/friends/{ana.Id}")).StatusCode); // twice is fine
    }

    [Fact]
    public async Task A_request_crossing_one_that_waits_the_other_way_accepts_it()
    {
        var (vule, mila) = (await app.PersonAsync(), await app.PersonAsync());
        (await vule.AskAsync(mila)).EnsureSuccessStatusCode();

        (await mila.AskAsync(vule)).EnsureSuccessStatusCode();

        Assert.Equal(mila.Id, Assert.Single((await vule.FriendsOfAsync()).Friends).UserId);
        Assert.Empty((await mila.FriendsOfAsync()).Outgoing);
        Assert.Single(app.Notifier.SentTo(vule.Id, "friend_accepted"));
        Assert.Empty(app.Notifier.SentTo(vule.Id, "friend_request"));
    }

    [Fact]
    public async Task Asking_again_changes_nothing_and_rings_once()
    {
        var (vule, mila) = (await app.PersonAsync(), await app.PersonAsync());
        (await vule.AskAsync(mila)).EnsureSuccessStatusCode();
        (await vule.AskAsync(mila)).EnsureSuccessStatusCode();
        // Withdrawing and asking again the same day does not ring her phone again either.
        (await vule.Http.DeleteAsync($"/api/friends/{mila.Id}")).EnsureSuccessStatusCode();
        (await vule.AskAsync(mila)).EnsureSuccessStatusCode();

        Assert.Single((await mila.FriendsOfAsync()).Incoming);
        Assert.Single(app.Notifier.SentTo(mila.Id, "friend_request"));
    }

    [Fact]
    public async Task Asking_yourself_or_nobody_is_refused()
    {
        var vule = await app.PersonAsync();

        Assert.Equal(HttpStatusCode.BadRequest, (await vule.AskAsync(vule)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await vule.Http.PostAsJsonAsync("/api/friends/requests", new { userId = Guid.NewGuid() })).StatusCode);
    }

    [Fact]
    public async Task Thirty_requests_a_day_then_too_many_and_withdrawing_does_not_give_one_back()
    {
        var vule = await app.PersonAsync();
        var others = new List<Actor>();
        for (var i = 0; i < 31; i++) others.Add(await app.PersonAsync());
        var start = DateTime.UtcNow;
        using var _ = app.Clock.At(start);

        for (var i = 0; i < 30; i++) (await vule.AskAsync(others[i])).EnsureSuccessStatusCode();
        (await vule.Http.DeleteAsync($"/api/friends/{others[0].Id}")).EnsureSuccessStatusCode();
        var refused = await vule.AskAsync(others[30]);

        Assert.Equal(HttpStatusCode.TooManyRequests, refused.StatusCode);
        Assert.Equal("too_many", (await refused.ProblemAsync()).Code);

        app.Clock.SetUtcNow(start.AddHours(24).AddMinutes(1));
        Assert.Equal(HttpStatusCode.NoContent, (await vule.AskAsync(others[30])).StatusCode);
    }

    // ── search ──

    [Fact]
    public async Task Search_finds_by_the_start_of_the_handle_or_the_shown_name()
    {
        var tag = "Zq" + Guid.NewGuid().ToString("N")[..6];
        var me = await app.PersonAsync();
        var byName = await app.PersonAsync($"{tag} Perić");
        var byHandle = await app.PersonAsync("Someone");
        await app.EditUserAsync(byHandle.Id, u => { u.UserName = tag.ToLowerInvariant() + "_x"; u.NormalizedUserName = u.UserName.ToUpperInvariant(); });
        var notAtStart = await app.PersonAsync($"Ana {tag}");

        var found = (await me.Http.GetFromJsonAsync<List<UserCard>>($"/api/users/search?q={tag.ToLowerInvariant()}"))!;
        var withAt = (await me.Http.GetFromJsonAsync<List<UserCard>>($"/api/users/search?q=@{tag}_x"))!;

        Assert.Equal(new HashSet<Guid> { byHandle.Id, byName.Id }, found.Select(c => c.UserId).ToHashSet());
        Assert.DoesNotContain(found, c => c.UserId == notAtStart.Id);
        var card = found.Single(c => c.UserId == byHandle.Id);
        Assert.Equal((tag.ToLowerInvariant() + "_x", "Someone", "S", Relation.None, (Guid?)null), (card.Handle, card.DisplayName, card.Initial, card.Relation, card.RequestId));
        Assert.Equal(byHandle.Id, Assert.Single(withAt).UserId);
    }

    [Fact]
    public async Task Search_needs_two_to_thirty_characters()
    {
        var me = await app.PersonAsync();

        Assert.Empty((await me.Http.GetFromJsonAsync<List<UserCard>>("/api/users/search?q=u"))!);
        Assert.Empty((await me.Http.GetFromJsonAsync<List<UserCard>>($"/api/users/search?q={new string('u', 31)}"))!);
        Assert.Equal(HttpStatusCode.Unauthorized, (await app.CreateClient().GetAsync("/api/users/search?q=uu")).StatusCode);
    }

    [Fact]
    public async Task Search_never_shows_yourself_door_logins_demo_hosts_or_banned_accounts()
    {
        var tag = "Zw" + Guid.NewGuid().ToString("N")[..6];
        var me = await app.PersonAsync($"{tag} Me");
        var plain = await app.PersonAsync($"{tag} Plain");
        var door = await app.PersonAsync($"{tag} Door");
        await app.AddRoleAsync(door.Id, Roles.Door);
        var demoHost = await app.PersonAsync($"{tag} Host");
        await app.EditUserAsync(demoHost.Id, u => { u.Email = $"demo-{tag}@findmyparty.demo"; u.NormalizedEmail = u.Email.ToUpperInvariant(); });
        var demoGuest = await app.PersonAsync($"{tag} Guest");
        await app.EditUserAsync(demoGuest.Id, u => { u.Email = $"demo-guest-{tag}@findmyparty.demo"; u.NormalizedEmail = u.Email.ToUpperInvariant(); });
        var banned = await app.PersonAsync($"{tag} Banned");
        await app.EditUserAsync(banned.Id, u => { u.LockoutEnabled = true; u.LockoutEnd = ReportService.Banned; });

        var found = (await me.Http.GetFromJsonAsync<List<UserCard>>($"/api/users/search?q={tag}"))!.Select(c => c.UserId).ToHashSet();

        Assert.Equal(new HashSet<Guid> { plain.Id, demoGuest.Id }, found);
        Assert.Equal(HttpStatusCode.NotFound, (await me.AskAsync(door)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await me.Http.GetAsync($"/api/users/by-handle/{await app.UserNameAsync(demoHost)}")).StatusCode);
    }

    [Fact]
    public async Task A_card_by_handle_says_how_we_relate()
    {
        var (vule, mila, luka) = (await app.PersonAsync(), await app.PersonAsync("Mila Perić"), await app.PersonAsync());
        (await vule.AskAsync(mila)).EnsureSuccessStatusCode();
        await vule.BefriendAsync(luka);
        var milaHandle = (await app.UserNameAsync(mila)).ToUpperInvariant(); // any case works

        var asMila = (await vule.Http.GetFromJsonAsync<UserCard>($"/api/users/by-handle/{milaHandle}"))!;
        var fromMila = (await mila.Http.GetFromJsonAsync<UserCard>($"/api/users/by-handle/@{await app.UserNameAsync(vule)}"))!;
        var asLuka = (await vule.Http.GetFromJsonAsync<UserCard>($"/api/users/by-handle/{await app.UserNameAsync(luka)}"))!;

        Assert.Equal((mila.Id, "Mila Perić", Relation.Requested), (asMila.UserId, asMila.DisplayName, asMila.Relation));
        Assert.NotNull(asMila.RequestId);
        Assert.Equal((Relation.Incoming, asMila.RequestId), (fromMila.Relation, fromMila.RequestId));
        Assert.Equal(Relation.Friend, asLuka.Relation);
        Assert.Equal(HttpStatusCode.NotFound, (await vule.Http.GetAsync("/api/users/by-handle/nobody-" + Guid.NewGuid().ToString("N"))).StatusCode);
    }

    // ── blocking ──

    [Fact]
    public async Task A_block_ends_the_friendship_and_hides_each_from_the_other_both_ways()
    {
        var tag = "Zb" + Guid.NewGuid().ToString("N")[..6];
        var vule = await app.PersonAsync($"{tag} Vule");
        var mila = await app.PersonAsync($"{tag} Mila");
        await vule.BefriendAsync(mila);

        Assert.Equal(HttpStatusCode.NoContent, (await mila.Http.PutAsync($"/api/users/{vule.Id}/block", null)).StatusCode);

        Assert.Empty((await vule.FriendsOfAsync()).Friends);
        Assert.Empty((await mila.FriendsOfAsync()).Friends);
        Assert.DoesNotContain((await vule.Http.GetFromJsonAsync<List<UserCard>>($"/api/users/search?q={tag}"))!, c => c.UserId == mila.Id);
        Assert.DoesNotContain((await mila.Http.GetFromJsonAsync<List<UserCard>>($"/api/users/search?q={tag}"))!, c => c.UserId == vule.Id);
        var vuleAsks = await vule.AskAsync(mila);
        var milaAsks = await mila.AskAsync(vule);
        Assert.Equal((HttpStatusCode.Conflict, "blocked"), (vuleAsks.StatusCode, (await vuleAsks.ProblemAsync()).Code));
        Assert.Equal((HttpStatusCode.Conflict, "blocked"), (milaAsks.StatusCode, (await milaAsks.ProblemAsync()).Code));
        // The blocked one cannot find her by handle; she still sees him, marked, so she can undo it.
        Assert.Equal(HttpStatusCode.NotFound, (await vule.Http.GetAsync($"/api/users/by-handle/{await app.UserNameAsync(mila)}")).StatusCode);
        Assert.Equal(Relation.Blocked, (await mila.Http.GetFromJsonAsync<UserCard>($"/api/users/by-handle/{await app.UserNameAsync(vule)}"))!.Relation);
        Assert.Equal(HttpStatusCode.NoContent, (await mila.Http.PutAsync($"/api/users/{vule.Id}/block", null)).StatusCode); // twice is fine
    }

    [Fact]
    public async Task Unblocking_lets_them_find_and_ask_each_other_again()
    {
        var tag = "Zu" + Guid.NewGuid().ToString("N")[..6];
        var vule = await app.PersonAsync($"{tag} Vule");
        var mila = await app.PersonAsync($"{tag} Mila");
        (await mila.Http.PutAsync($"/api/users/{vule.Id}/block", null)).EnsureSuccessStatusCode();

        (await mila.Http.DeleteAsync($"/api/users/{vule.Id}/block")).EnsureSuccessStatusCode();

        Assert.Contains((await vule.Http.GetFromJsonAsync<List<UserCard>>($"/api/users/search?q={tag}"))!, c => c.UserId == mila.Id);
        Assert.Equal(HttpStatusCode.NoContent, (await vule.AskAsync(mila)).StatusCode);
    }

    // ── the list, the invite link ──

    [Fact]
    public async Task The_list_carries_my_switches_and_my_invite_link()
    {
        var vule = await app.PersonAsync("Vule Marković");
        await vule.PrivacyAsync(share: true, invisible: true);

        var list = await vule.FriendsOfAsync();

        Assert.True(list.Sharing);
        Assert.False(list.Suspended);
        Assert.NotNull(list.InvisibleUntil);
        Assert.EndsWith($"/i/{await app.UserNameAsync(vule)}", list.InviteUrl);
        Assert.StartsWith("http", list.InviteUrl);
    }

    [Fact]
    public async Task A_friend_shows_whether_they_share()
    {
        var (vule, mila, luka) = (await app.PersonAsync("Vule"), await app.PersonAsync("Mila"), await app.PersonAsync("Luka"));
        await vule.BefriendAsync(mila);
        await vule.BefriendAsync(luka);
        await mila.ShareAsync();

        var friends = (await vule.FriendsOfAsync()).Friends;

        Assert.Equal([("Luka", false), ("Mila", true)], friends.Select(f => (f.DisplayName, f.Sharing)));
    }

    [Fact]
    public async Task The_invite_page_has_the_preview_tags_and_opens_the_app()
    {
        var vule = await app.PersonAsync("Vule Marković");
        var handle = await app.UserNameAsync(vule);

        var page = await app.CreateClient().GetAsync($"/i/{handle}");
        var html = await page.Content.ReadAsStringAsync();
        var unknown = await app.CreateClient().GetAsync("/i/nobody-" + Guid.NewGuid().ToString("N"));

        Assert.Equal(HttpStatusCode.OK, page.StatusCode);
        Assert.Contains("<meta property=\"og:title\" content=\"Vule is on FindMyParty\">", html);
        Assert.Contains("<meta property=\"og:description\" content=\"See where the night is.\">", html);
        Assert.Contains("/og.png", html);
        Assert.Contains($"findmypartymobileapp://invite/{handle}", html);
        Assert.Equal(HttpStatusCode.NotFound, unknown.StatusCode);
    }

    // ── deleting an account ──

    [Fact]
    public async Task Deleting_an_account_removes_its_friendships_blocks_requests_and_reports()
    {
        var (gone, mila, luka, ana) = (await app.PersonAsync(), await app.PersonAsync(), await app.PersonAsync(), await app.PersonAsync());
        await gone.BefriendAsync(mila);
        (await gone.AskAsync(luka)).EnsureSuccessStatusCode();
        (await ana.Http.PutAsync($"/api/users/{gone.Id}/block", null)).EnsureSuccessStatusCode();
        (await gone.Http.PostAsJsonAsync($"/api/users/{ana.Id}/report", new { reason = "spam" })).EnsureSuccessStatusCode();
        (await ana.Http.PostAsJsonAsync($"/api/users/{gone.Id}/report", new { reason = "spam" })).EnsureSuccessStatusCode();

        (await gone.Http.DeleteAsync("/api/auth/account")).EnsureSuccessStatusCode();

        Assert.Empty((await mila.FriendsOfAsync()).Friends);
        Assert.Empty((await luka.FriendsOfAsync()).Incoming);
        var left = await app.WithDb(async db => new[]
        {
            await db.Set<Friendship>().CountAsync(f => f.UserLowId == gone.Id || f.UserHighId == gone.Id),
            await db.Set<UserBlock>().CountAsync(b => b.BlockerId == gone.Id || b.BlockedId == gone.Id),
            await db.Set<UserReport>().CountAsync(r => r.ReporterId == gone.Id || r.ReportedUserId == gone.Id),
            await db.Set<FriendRequestLog>().CountAsync(l => l.FromUserId == gone.Id || l.ToUserId == gone.Id),
        });
        Assert.Equal([0, 0, 0, 0], left);
    }

    [Fact]
    public async Task Friends_need_a_signed_in_account()
    {
        var http = app.CreateClient();

        Assert.Equal(HttpStatusCode.Unauthorized, (await http.GetAsync("/api/friends")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await http.GetAsync("/api/friends/out?city=podgorica")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await http.PatchAsJsonAsync("/api/me/privacy", new { shareWithFriends = true })).StatusCode);
    }
}
