using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FindMyParty.Api.Bookings;
using FindMyParty.Api.Data;
using FindMyParty.Api.Demo;
using FindMyParty.Api.Identity;
using FindMyParty.Api.Me;
using FindMyParty.Api.Parties;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace FindMyParty.Api.Tests;

/// <summary>Helpers for tests about the account (A1).</summary>
public static class MeTestHelpers
{
    public static async Task<JsonElement> MeAsync(this Actor actor)
    {
        var response = await actor.Http.GetAsync("/api/me");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    public static Task<HttpResponseMessage> PatchMeAsync(this Actor actor, object body) =>
        actor.Http.PatchAsJsonAsync("/api/me", body);

    public static async Task<string?> CodeOf(this HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<JsonElement>()).TryGetProperty("code", out var code) ? code.GetString() : null;

    public static Task SetUserAsync(this TestApp app, Guid userId, Action<ApplicationUser> change) =>
        app.WithDb(async db =>
        {
            var id = userId.ToString();
            var user = await db.Users.SingleAsync(u => u.Id == id);
            change(user);
            await db.SaveChangesAsync();
            return true;
        });

    /// <summary>Parties with these genres (made straight in the database), with this user scanned into each.</summary>
    public static Task ScannedIntoAsync(this TestApp app, Guid guestId, params string?[] genres) =>
        app.WithDb(async db =>
        {
            var hostId = Guid.NewGuid();
            foreach (var genre in genres)
            {
                var party = new Party(hostId, null, new PartyRequest
                {
                    Title = "Scan night", Description = "", Price = 5, Capacity = 50,
                    StartsAt = DateTime.UtcNow.AddHours(-3), EndsAt = DateTime.UtcNow.AddHours(2),
                    Latitude = 42.44, Longitude = 19.26, Genre = genre,
                });
                db.Parties.Add(party);
                db.CheckIns.Add(new CheckIn
                {
                    Id = Guid.NewGuid(), BookingId = Guid.NewGuid(), PartyId = party.Id, Admitted = 1,
                    At = DateTime.UtcNow.AddHours(-1), ByUserId = hostId, GuestUserId = guestId,
                });
            }
            await db.SaveChangesAsync();
            return true;
        });

    public static List<(string Genre, int Percent)> Sound(this JsonElement me) =>
        me.GetProperty("sound").EnumerateArray()
            .Select(s => (s.GetProperty("genre").GetString()!, s.GetProperty("percent").GetInt32()))
            .ToList();
}

[Collection("api")]
public class MeTests(TestApp app)
{
    private async Task<Actor> RegisterAsync(string userName)
    {
        var email = $"{Guid.NewGuid():N}@example.test";
        var response = await app.CreateClient().PostAsJsonAsync("/api/auth/register", new { userName, email, password = Actor.DefaultPassword });
        response.EnsureSuccessStatusCode();
        return await app.LoginAsync(email);
    }

    [Fact]
    public async Task Me_needs_a_token()
    {
        var http = app.CreateClient();

        Assert.Equal(HttpStatusCode.Unauthorized, (await http.GetAsync("/api/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await http.PatchAsJsonAsync("/api/me", new { displayName = "Vule" })).StatusCode);
    }

    [Fact]
    public async Task A_new_account_reads_back_with_its_defaults()
    {
        var name = "Vule" + Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
        var user = await RegisterAsync(name);

        var me = await user.MeAsync();

        Assert.Equal(user.Id, me.GetProperty("id").GetGuid());
        Assert.Equal(name, me.GetProperty("userName").GetString());
        Assert.Equal(name.ToLowerInvariant(), me.GetProperty("handle").GetString());
        Assert.Equal(name, me.GetProperty("displayName").GetString());
        Assert.Equal(user.Email, me.GetProperty("email").GetString());
        Assert.Contains("User", me.GetProperty("roles").EnumerateArray().Select(r => r.GetString()));
        Assert.Equal(JsonValueKind.Null, me.GetProperty("city").ValueKind);
        Assert.Empty(me.GetProperty("taste").EnumerateArray());
        Assert.Empty(me.GetProperty("sound").EnumerateArray());
        Assert.Equal("Spark", me.GetProperty("level").GetProperty("name").GetString());
        Assert.Equal(1, me.GetProperty("level").GetProperty("number").GetInt32());
        Assert.Equal(0, me.GetProperty("glowLifetime").GetInt32());
        var privacy = me.GetProperty("privacy");
        Assert.False(privacy.GetProperty("shareWithFriends").GetBoolean());
        Assert.Equal(JsonValueKind.Null, privacy.GetProperty("invisibleUntil").ValueKind);
        Assert.False(privacy.GetProperty("suspended").GetBoolean());
        var notifications = me.GetProperty("notifications");
        Assert.True(notifications.GetProperty("venues").GetBoolean());
        Assert.True(notifications.GetProperty("friends").GetBoolean());
        Assert.True(notifications.GetProperty("nights").GetBoolean());
        Assert.True(me.GetProperty("hasPassword").GetBoolean());
        Assert.Equal(JsonValueKind.Null, me.GetProperty("venueId").ValueKind);
    }

    [Fact]
    public async Task CreatedAt_is_set_at_registration()
    {
        var before = DateTime.UtcNow.AddMinutes(-1);
        var user = await app.UserAsync();

        var me = await user.MeAsync();

        var createdAt = me.GetProperty("createdAt").GetDateTime().ToUniversalTime();
        Assert.InRange(createdAt, before, DateTime.UtcNow.AddMinutes(1));
        Assert.EndsWith("Z", me.GetProperty("createdAt").GetString());
    }

    [Fact]
    public async Task A_host_sees_their_venue_id()
    {
        var host = await app.HostAsync();
        var hostId = host.Id.ToString();
        var venueId = await app.WithDb(db => db.VenueProfiles.Where(v => v.UserId == hostId).Select(v => v.Id).SingleAsync());

        var me = await host.MeAsync();

        Assert.Equal(venueId, me.GetProperty("venueId").GetGuid());
        Assert.Contains("Host", me.GetProperty("roles").EnumerateArray().Select(r => r.GetString()));
    }

    [Theory]
    [InlineData(0, "Spark", 1)]
    [InlineData(299, "Spark", 1)]
    [InlineData(300, "Ember", 2)]
    [InlineData(1240, "Flame", 3)]
    [InlineData(4000, "Inferno", 5)]
    public async Task The_level_follows_lifetime_Glow(int lifetime, string name, int number)
    {
        var user = await app.UserAsync();
        await app.SetUserAsync(user.Id, u => { u.GlowLifetime = lifetime; u.GlowBalance = 0; });

        var me = await user.MeAsync();

        Assert.Equal(name, me.GetProperty("level").GetProperty("name").GetString());
        Assert.Equal(number, me.GetProperty("level").GetProperty("number").GetInt32());
        Assert.Equal(lifetime, me.GetProperty("glowLifetime").GetInt32());
    }

    [Fact]
    public async Task Privacy_reads_from_the_account()
    {
        var user = await app.UserAsync();
        var until = DateTime.UtcNow.AddHours(5);
        await app.SetUserAsync(user.Id, u => { u.ShareWithFriends = true; u.InvisibleUntil = until; u.SharingSuspended = true; });

        var privacy = (await user.MeAsync()).GetProperty("privacy");

        Assert.True(privacy.GetProperty("shareWithFriends").GetBoolean());
        Assert.Equal(until, privacy.GetProperty("invisibleUntil").GetDateTime().ToUniversalTime(), TimeSpan.FromMilliseconds(1));
        Assert.True(privacy.GetProperty("suspended").GetBoolean());
    }

    [Fact]
    public async Task An_account_made_with_Google_has_no_password()
    {
        var token = "google-" + Guid.NewGuid();
        var email = $"{Guid.NewGuid():N}@example.test";
        app.ExternalAuth.Tokens[token] = new ExternalIdentity(email, "g-" + Guid.NewGuid(), "Mila Peric", EmailVerified: true);
        var signedIn = await app.CreateClient().PostAsJsonAsync("/api/auth/external", new { provider = "Google", idToken = token });
        signedIn.EnsureSuccessStatusCode();
        var tokens = (await signedIn.Content.ReadFromJsonAsync<LoginResponse>())!;
        var http = app.CreateClient();
        http.DefaultRequestHeaders.Authorization = new("Bearer", tokens.AccessToken);

        var me = await http.GetFromJsonAsync<JsonElement>("/api/me");

        Assert.False(me.GetProperty("hasPassword").GetBoolean());
    }

    // ── changing it ──

    [Fact]
    public async Task Patch_changes_only_what_is_sent()
    {
        var user = await app.UserAsync();

        var response = await user.PatchMeAsync(new
        {
            displayName = "  Vule Marković ",
            city = "budva",
            taste = new[] { "Live", "Techno", "House" },
            notifications = new { friends = false },
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var patched = await response.Content.ReadFromJsonAsync<JsonElement>();
        var me = await user.MeAsync();
        foreach (var json in new[] { patched, me })
        {
            Assert.Equal("Vule Marković", json.GetProperty("displayName").GetString());
            Assert.Equal("budva", json.GetProperty("city").GetString());
            Assert.Equal(["Live", "Techno", "House"], json.GetProperty("taste").EnumerateArray().Select(t => t.GetString()));
            Assert.True(json.GetProperty("notifications").GetProperty("venues").GetBoolean());
            Assert.False(json.GetProperty("notifications").GetProperty("friends").GetBoolean());
            Assert.True(json.GetProperty("notifications").GetProperty("nights").GetBoolean());
        }

        // A second change leaves the first alone.
        (await user.PatchMeAsync(new { notifications = new { nights = false } })).EnsureSuccessStatusCode();
        me = await user.MeAsync();
        Assert.Equal("Vule Marković", me.GetProperty("displayName").GetString());
        Assert.Equal("budva", me.GetProperty("city").GetString());
        Assert.Equal(3, me.GetProperty("taste").GetArrayLength());
        Assert.False(me.GetProperty("notifications").GetProperty("friends").GetBoolean());
        Assert.False(me.GetProperty("notifications").GetProperty("nights").GetBoolean());

        var id = user.Id.ToString();
        var row = await app.WithDb(db => db.Users.AsNoTracking().SingleAsync(u => u.Id == id));
        Assert.Equal("budva", row.HomeCity);
        Assert.Equal("Live,Techno,House", row.Taste);
        Assert.False(row.NotifyFriends);
        Assert.False(row.NotifyNights);
        Assert.True(row.NotifyVenues);
    }

    [Fact]
    public async Task Taste_takes_the_list_names_in_any_case_and_an_empty_list_clears_it()
    {
        var user = await app.UserAsync();

        var me = await (await user.PatchMeAsync(new { taste = new[] { "techno", "r&b", "HIP-HOP", "techno" } })).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(["Techno", "R&B", "Hip-Hop"], me.GetProperty("taste").EnumerateArray().Select(t => t.GetString()));

        me = await (await user.PatchMeAsync(new { taste = Array.Empty<string>() })).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Empty(me.GetProperty("taste").EnumerateArray());
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("12345678901234567890123456789012345678901")]
    public async Task A_name_must_be_1_to_40_characters(string name)
    {
        var user = await app.UserAsync();

        var response = await user.PatchMeAsync(new { displayName = name });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("name_invalid", await response.CodeOf());
    }

    [Fact]
    public async Task A_name_of_40_characters_is_fine()
    {
        var user = await app.UserAsync();
        var name = new string('a', 40);

        var response = await user.PatchMeAsync(new { displayName = name });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(name, (await user.MeAsync()).GetProperty("displayName").GetString());
    }

    [Theory]
    [InlineData("atlantis")]
    [InlineData("")]
    public async Task An_unknown_city_is_refused(string city)
    {
        var user = await app.UserAsync();

        var response = await user.PatchMeAsync(new { city });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("city_unknown", await response.CodeOf());
    }

    [Fact]
    public async Task Taste_takes_only_genres_from_the_list_and_at_most_nine()
    {
        var user = await app.UserAsync();

        var unknown = await user.PatchMeAsync(new { taste = new[] { "Techno", "Jazz" } });
        var tooMany = await user.PatchMeAsync(new { taste = new[] { "Techno", "House", "Hip-Hop", "Balkan", "Live", "Pop", "Latin", "R&B", "Rock", "Techno" } });
        var blank = await user.PatchMeAsync(new { taste = new[] { "Techno", " " } });

        foreach (var response in new[] { unknown, tooMany, blank })
        {
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("taste_invalid", await response.CodeOf());
        }
    }

    [Fact]
    public async Task A_refused_change_changes_nothing()
    {
        var user = await app.UserAsync();

        var response = await user.PatchMeAsync(new { displayName = "Mila", city = "atlantis", taste = new[] { "Techno" } });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var me = await user.MeAsync();
        Assert.NotEqual("Mila", me.GetProperty("displayName").GetString());
        Assert.Empty(me.GetProperty("taste").EnumerateArray());
    }

    // ── your sound ──

    [Fact]
    public async Task With_no_scans_the_sound_is_the_first_three_picks_at_52_30_18()
    {
        var user = await app.UserAsync();

        await user.PatchMeAsync(new { taste = new[] { "Techno", "House", "Live", "Pop" } });
        Assert.Equal([("Techno", 52), ("House", 30), ("Live", 18)], (await user.MeAsync()).Sound());

        await user.PatchMeAsync(new { taste = new[] { "Balkan", "Rock" } });
        Assert.Equal([("Balkan", 62), ("Rock", 38)], (await user.MeAsync()).Sound());

        await user.PatchMeAsync(new { taste = new[] { "Latin" } });
        Assert.Equal([("Latin", 100)], (await user.MeAsync()).Sound());
    }

    [Fact]
    public async Task With_scans_the_sound_is_the_three_genres_of_the_parties_scanned_into()
    {
        var user = await app.UserAsync();
        await user.PatchMeAsync(new { taste = new[] { "Rock", "Pop", "Latin" } });
        await app.ScannedIntoAsync(user.Id, "Techno", "House", "Techno", "Live", "Techno", "House", "Techno", "Techno", "House", "Live", "Pop", null);

        var sound = (await user.MeAsync()).Sound();

        // Techno 5, House 3, Live 2 (Pop 1 is fourth; a party with no genre does not count).
        Assert.Equal([("Techno", 50), ("House", 30), ("Live", 20)], sound);
    }

    [Fact]
    public async Task Percentages_always_add_up_to_100()
    {
        var user = await app.UserAsync();
        await app.ScannedIntoAsync(user.Id, "Techno", "House", "Live");

        var sound = (await user.MeAsync()).Sound();

        Assert.Equal(100, sound.Sum(s => s.Percent));
        Assert.Equal([34, 33, 33], sound.Select(s => s.Percent));
    }

    [Fact]
    public async Task A_party_scanned_into_twice_counts_once()
    {
        var user = await app.UserAsync();
        await app.ScannedIntoAsync(user.Id, "Balkan", "Techno");
        await app.WithDb(async db =>
        {
            var first = await db.CheckIns.FirstAsync(c => c.GuestUserId == user.Id);
            db.CheckIns.Add(new CheckIn { Id = Guid.NewGuid(), BookingId = first.BookingId, PartyId = first.PartyId, Admitted = 1, At = first.At.AddMinutes(5), ByUserId = first.ByUserId, GuestUserId = user.Id });
            await db.SaveChangesAsync();
            return true;
        });

        var sound = (await user.MeAsync()).Sound();

        Assert.Equal([50, 50], sound.Select(s => s.Percent));
    }

    // ── demo ──

    [Fact]
    public async Task Demo_guests_get_a_city_and_a_sound_and_a_second_run_keeps_their_own_changes()
    {
        var database = "me_seed_" + Guid.NewGuid().ToString("N")[..10];
        using var seeded = app.With(new()
        {
            ["ConnectionStrings:DefaultConnection"] = app.ConnectionStringFor(database),
            ["Seed:Demo"] = "true",
        });
        seeded.CreateClient();

        using var scope = seeded.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var guests = await db.Users.Where(u => u.Email!.StartsWith("demo-guest-") && u.Email.EndsWith("@" + DemoSeeder.EmailDomain)).ToListAsync();
        Assert.Equal(24, guests.Count);
        Assert.All(guests, g => Assert.Equal("podgorica", g.HomeCity));
        Assert.All(guests, g => Assert.Equal(Taste.Parse(g.Taste), Taste.Normalise(Taste.Parse(g.Taste))));
        Assert.All(guests, g => Assert.NotEmpty(Taste.Parse(g.Taste)));
        var mila = guests.Single(g => g.UserName == "mila");
        Assert.Equal("Techno,House,Live", mila.Taste);

        mila.Taste = "Rock";
        await db.SaveChangesAsync();
        await scope.ServiceProvider.GetRequiredService<DemoSeeder>().EnsureAsync();

        db.ChangeTracker.Clear();
        Assert.Equal("Rock", (await db.Users.SingleAsync(u => u.Id == mila.Id)).Taste);
    }
}
