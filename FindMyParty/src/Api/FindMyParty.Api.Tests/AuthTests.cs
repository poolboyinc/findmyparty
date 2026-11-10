using System.Net;
using System.Net.Http.Json;
using FindMyParty.Api.Bookings;
using FindMyParty.Api.Identity;
using FindMyParty.Api.Parties;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace FindMyParty.Api.Tests;

[Collection("api")]
public class AuthTests(TestApp app)
{
    private Task<HttpResponseMessage> Refresh(object body) => app.CreateClient().PostAsJsonAsync("/api/auth/refresh", body);

    // ── staying signed in ──

    [Fact]
    public async Task A_refresh_token_is_exchanged_for_a_new_pair_and_then_stops_working()
    {
        var user = await app.UserAsync();

        var first = await Refresh(new { userId = user.Id, refreshToken = user.Tokens.RefreshToken });
        var again = await Refresh(new { userId = user.Id, refreshToken = user.Tokens.RefreshToken });

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        var pair = (await first.Content.ReadFromJsonAsync<LoginResponse>())!;
        Assert.NotEqual(user.Tokens.RefreshToken, pair.RefreshToken);
        Assert.Equal(HttpStatusCode.Unauthorized, again.StatusCode);
    }

    [Fact]
    public async Task Refresh_works_with_the_token_alone()
    {
        var user = await app.UserAsync();

        var response = await Refresh(new { refreshToken = user.Tokens.RefreshToken });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Signing_in_on_a_second_phone_does_not_sign_the_first_one_out()
    {
        var phone = await app.UserAsync();
        var tablet = await app.LoginAsync(phone.Email);

        var fromPhone = await Refresh(new { userId = phone.Id, refreshToken = phone.Tokens.RefreshToken });
        var fromTablet = await Refresh(new { userId = tablet.Id, refreshToken = tablet.Tokens.RefreshToken });

        Assert.Equal(HttpStatusCode.OK, fromPhone.StatusCode);
        Assert.Equal(HttpStatusCode.OK, fromTablet.StatusCode);
    }

    [Fact]
    public async Task Signing_out_ends_that_devices_session_only()
    {
        var phone = await app.UserAsync();
        var tablet = await app.LoginAsync(phone.Email);

        var signOut = await phone.Http.PostAsJsonAsync("/api/auth/logout", new { refreshToken = phone.Tokens.RefreshToken });

        Assert.Equal(HttpStatusCode.NoContent, signOut.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(new { refreshToken = phone.Tokens.RefreshToken })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Refresh(new { refreshToken = tablet.Tokens.RefreshToken })).StatusCode);
    }

    [Fact]
    public async Task Refresh_tokens_are_not_stored_in_readable_form()
    {
        var user = await app.UserAsync();

        var stored = await app.WithDb(db => db.Database.SqlQueryRaw<string>(
            "SELECT string_agg(t::text, ' ') AS \"Value\" FROM \"RefreshTokens\" t WHERE \"UserId\" = {0}", user.Id.ToString()).SingleAsync());

        Assert.DoesNotContain(user.Tokens.RefreshToken, stored);
    }

    // ── guessing passwords ──

    [Fact]
    public async Task Five_wrong_passwords_lock_the_account_for_a_while()
    {
        var user = await app.UserAsync();
        var client = app.CreateClient();
        for (var i = 0; i < 5; i++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login", new { email = user.Email, password = "wrong-" + i })).StatusCode);

        var withRightPassword = await client.PostAsJsonAsync("/api/auth/login", new { email = user.Email, password = Actor.DefaultPassword });

        Assert.Equal(HttpStatusCode.TooManyRequests, withRightPassword.StatusCode);
    }

    [Fact]
    public async Task Each_address_gets_its_own_sign_in_allowance()
    {
        using var limited = app.WithWebHostBuilder(b => b.ConfigureAppConfiguration((_, c) =>
            c.AddInMemoryCollection(new Dictionary<string, string?> { ["RateLimits:AuthPerMinute"] = "3" })));
        var client = limited.CreateClient();

        async Task<HttpStatusCode> LoginFrom(string address)
        {
            var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login") { Content = JsonContent.Create(new { email = "nobody@example.test", password = "x" }) };
            request.Headers.Add("X-Forwarded-For", address);
            return (await client.SendAsync(request)).StatusCode;
        }

        var first = new[] { await LoginFrom("203.0.113.7"), await LoginFrom("203.0.113.7"), await LoginFrom("203.0.113.7"), await LoginFrom("203.0.113.7") };
        var other = await LoginFrom("203.0.113.99");

        Assert.Equal(HttpStatusCode.TooManyRequests, first[3]);
        Assert.Equal(HttpStatusCode.Unauthorized, other);
    }

    // ── Google and Apple ──

    [Fact]
    public async Task A_Google_account_with_an_unverified_email_is_refused()
    {
        app.ExternalAuth.Tokens["g-unverified"] = new ExternalIdentity($"{Guid.NewGuid():N}@example.test", "g-" + Guid.NewGuid(), "Someone", EmailVerified: false);

        var response = await app.CreateClient().PostAsJsonAsync("/api/auth/external", new { provider = "google", idToken = "g-unverified" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Social_sign_in_does_not_hand_over_an_account_someone_else_registered_with_that_email()
    {
        // An attacker registers the victim's address with a password before the victim ever signs up.
        var squatter = await app.UserAsync(email: $"victim-{Guid.NewGuid():N}@example.test");
        app.ExternalAuth.Tokens["g-victim"] = new ExternalIdentity(squatter.Email, "g-" + Guid.NewGuid(), "Victim", EmailVerified: true);

        var response = await app.CreateClient().PostAsJsonAsync("/api/auth/external", new { provider = "google", idToken = "g-victim" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task A_new_Google_user_gets_an_account_and_the_same_one_next_time()
    {
        var email = $"{Guid.NewGuid():N}@example.test";
        app.ExternalAuth.Tokens["g-new"] = new ExternalIdentity(email, "g-" + Guid.NewGuid(), "Lena K", EmailVerified: true);
        var client = app.CreateClient();

        var first = await client.PostAsJsonAsync("/api/auth/external", new { provider = "google", idToken = "g-new" });
        var second = await client.PostAsJsonAsync("/api/auth/external", new { provider = "google", idToken = "g-new" });

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        Assert.Equal(1, await app.WithDb(db => db.Users.CountAsync(u => u.Email == email)));
    }

    // ── hosts ──

    [Fact]
    public async Task A_host_can_read_and_edit_their_own_venue()
    {
        var host = await app.HostAsync();

        var read = await host.Http.GetAsync("/api/hosts/profile");
        var edit = await host.Http.PatchAsJsonAsync("/api/hosts/profile", new { venueName = "Monkey", workingDays = "Thu,Fri,Sat" });

        Assert.Equal(HttpStatusCode.OK, read.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, edit.StatusCode);
        Assert.Equal("Monkey", (await host.Http.GetFromJsonAsync<VenueProfileDto>("/api/hosts/profile"))!.VenueName);
    }

    [Fact]
    public async Task Only_an_admin_can_make_someone_a_host()
    {
        var target = await app.UserAsync();
        var venue = new { venueName = "Kula", address = "Njegoševa 1", latitude = 42.44, longitude = 19.26 };

        var byHost = await (await app.HostAsync()).Http.PostAsJsonAsync($"/api/hosts/{target.Id}", venue);
        var byAdmin = await (await app.AdminAsync()).Http.PostAsJsonAsync($"/api/hosts/{target.Id}", venue);

        Assert.Equal(HttpStatusCode.Forbidden, byHost.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, byAdmin.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await (await app.LoginAsync(target.Email)).Http.GetAsync("/api/hosts/profile")).StatusCode);
    }

    [Fact]
    public async Task The_configured_owner_becomes_admin_when_the_service_starts()
    {
        var owner = await app.UserAsync();
        using var restarted = app.WithWebHostBuilder(b => b.ConfigureAppConfiguration((_, c) =>
            c.AddInMemoryCollection(new Dictionary<string, string?> { ["Bootstrap:AdminEmail"] = owner.Email })));
        restarted.CreateClient(); // starts the service

        var listUsers = await (await app.LoginAsync(owner.Email)).Http.GetAsync("/api/users");

        Assert.Equal(HttpStatusCode.OK, listUsers.StatusCode);
    }

    // ── leaving ──

    [Fact]
    public async Task Deleting_an_account_removes_its_bookings_and_gives_the_spots_back()
    {
        var party = await app.PublishedPartyAsync(await app.HostAsync(), capacity: 10);
        var guest = await app.UserAsync();
        await guest.BookedAsync(party, tickets: 3);

        var response = await guest.Http.DeleteAsync("/api/auth/account");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(0, await app.TicketsSoldAsync(party));
        Assert.Equal(0, await app.WithDb(db => db.Bookings.CountAsync(b => b.UserId == guest.Id)));
        Assert.Equal(HttpStatusCode.Unauthorized, (await Refresh(new { refreshToken = guest.Tokens.RefreshToken })).StatusCode);
    }

    [Fact]
    public async Task Deleting_a_host_account_cancels_their_parties_and_the_bookings_on_them()
    {
        var host = await app.HostAsync();
        var party = await app.PublishedPartyAsync(host);
        var booking = await (await app.UserAsync()).BookedAsync(party, tickets: 2);

        (await host.Http.DeleteAsync("/api/auth/account")).EnsureSuccessStatusCode();

        Assert.Equal(PartyStatus.Cancelled, await app.WithDb(db => db.Parties.Where(p => p.Id == party).Select(p => p.Status).SingleAsync()));
        Assert.Equal(BookingStatus.Cancelled, await app.WithDb(db => db.Bookings.Where(b => b.Id == booking).Select(b => b.Status).SingleAsync()));
        Assert.DoesNotContain(await app.CreateClient().GetFromJsonAsync<List<PartyResponse>>("/api/parties?pageSize=100") ?? [], p => p.Id == party);
    }

    [Fact]
    public async Task Health_reports_whether_the_database_answers()
    {
        var body = await app.CreateClient().GetFromJsonAsync<Dictionary<string, string>>("/health");

        Assert.Equal("healthy", body!["status"]);
        Assert.Equal("ok", body["database"]);
    }
}

public class SigningKeyTests
{
    [Theory]
    [InlineData("")]
    [InlineData("short")]
    [InlineData("DEV_ONLY_local_signing_key_never_use_in_production_0123456789")]
    public void Production_refuses_to_start_with_a_missing_weak_or_development_key(string key)
    {
        Assert.Throws<InvalidOperationException>(() => SigningKey.Require(key, isDevelopment: false));
    }

    [Fact]
    public void Production_accepts_a_long_random_key()
    {
        SigningKey.Require("f3b1c7e09a4d4c6e8b2a5d7f1e3c9b0a6d8e2f4a1c3b5d7e", isDevelopment: false);
    }

    [Fact]
    public void Development_may_use_the_development_key()
    {
        SigningKey.Require("DEV_ONLY_local_signing_key_never_use_in_production_0123456789", isDevelopment: true);
    }
}
