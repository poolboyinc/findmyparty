using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FindMyParty.Api.Common;
using FindMyParty.Api.Messaging;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Xunit;

namespace FindMyParty.Api.Tests;

/// <summary>
/// Stands in for Expo's push service: records every request and answers each message "ok", or "DeviceNotRegistered"
/// for a token in `Dead`. Nothing reaches the internet.
/// </summary>
public class StubExpo : HttpMessageHandler
{
    public record Sent(Uri Url, string? Authorization, JsonElement Body);

    private readonly ConcurrentQueue<Sent> _sent = new();
    public IReadOnlyList<Sent> Requests => _sent.ToArray();
    public HashSet<string> Dead { get; } = [];
    /// <summary>Answer every request with this status instead.</summary>
    public HttpStatusCode? FailWith { get; set; }
    /// <summary>Fail every request as if the network were down.</summary>
    public bool Unreachable { get; set; }

    public IEnumerable<JsonElement> Messages => Requests.SelectMany(r => r.Body.EnumerateArray());

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        var body = await request.Content!.ReadFromJsonAsync<JsonElement>(ct);
        _sent.Enqueue(new Sent(request.RequestUri!, request.Headers.Authorization?.ToString(), body));
        if (Unreachable) throw new HttpRequestException("network down");
        if (FailWith is { } status) return new HttpResponseMessage(status) { Content = JsonContent.Create(new { errors = new[] { new { code = "INTERNAL", message = "boom" } } }) };

        var tickets = body.EnumerateArray().Select(m => Dead.Contains(m.GetProperty("to").GetString()!)
            ? (object)new { status = "error", message = "not registered", details = new { error = "DeviceNotRegistered" } }
            : new { status = "ok", id = Guid.NewGuid().ToString() });
        return new HttpResponseMessage(HttpStatusCode.OK) { Content = JsonContent.Create(new { data = tickets }) };
    }
}

[Collection("api")]
public class PushTests(TestApp app)
{
    private static string NewToken() => $"ExponentPushToken[{Guid.NewGuid():N}]";

    /// <summary>A host that pushes through the real Expo notifier, into the stub.</summary>
    private WebApplicationFactory<Program> PushHost(StubExpo expo, Dictionary<string, string?>? settings = null) => app.WithServices(s =>
    {
        s.RemoveAll<INotifier>();
        s.AddSingleton<INotifier, ExpoNotifier>();
        s.AddHttpClient(ExpoPushSender.HttpClientName).ConfigurePrimaryHttpMessageHandler(() => expo);
    }, settings);

    private static async Task PushAsync(WebApplicationFactory<Program> host, Push push)
    {
        await host.Services.GetRequiredService<INotifier>().SendAsync(push);
        await host.Services.GetRequiredService<PushWorker>().RunOnceAsync();
    }

    private Task AddDevicesAsync(Guid userId, IEnumerable<string> tokens) => app.WithDb(async db =>
    {
        var now = DateTime.UtcNow;
        db.Set<PushDevice>().AddRange(tokens.Select(t => new PushDevice { Id = Guid.NewGuid(), UserId = userId, ExpoToken = t, Platform = "ios", CreatedAt = now, LastSeenAt = now }));
        await db.SaveChangesAsync();
        return true;
    });

    private Task<List<PushDevice>> DevicesAsync(Guid userId) =>
        app.WithDb(db => db.Set<PushDevice>().AsNoTracking().Where(d => d.UserId == userId).ToListAsync());

    private static Task<HttpResponseMessage> RegisterAsync(Actor actor, string token, string platform = "ios") =>
        actor.Http.PutAsJsonAsync("/api/me/devices", new { expoPushToken = token, platform });

    // ── devices ──

    [Fact]
    public async Task Devices_need_a_token()
    {
        var http = app.CreateClient();

        Assert.Equal(HttpStatusCode.Unauthorized, (await http.PutAsJsonAsync("/api/me/devices", new { expoPushToken = NewToken(), platform = "ios" })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await http.DeleteAsync($"/api/me/devices/{Uri.EscapeDataString(NewToken())}")).StatusCode);
    }

    [Fact]
    public async Task A_device_registers_and_registering_again_keeps_one_row()
    {
        var user = await app.UserAsync();
        var token = NewToken();

        Assert.Equal(HttpStatusCode.NoContent, (await RegisterAsync(user, token)).StatusCode);
        var first = Assert.Single(await DevicesAsync(user.Id));
        Assert.Equal(HttpStatusCode.NoContent, (await RegisterAsync(user, token, "android")).StatusCode);

        var device = Assert.Single(await DevicesAsync(user.Id));
        Assert.Equal(token, device.ExpoToken);
        Assert.Equal("android", device.Platform);
        Assert.Equal(first.Id, device.Id);
        Assert.True(device.LastSeenAt >= first.LastSeenAt);
    }

    [Fact]
    public async Task A_token_moves_to_whoever_registers_it_last()
    {
        var mila = await app.UserAsync();
        var luka = await app.UserAsync();
        var token = NewToken();

        await RegisterAsync(mila, token);
        await RegisterAsync(luka, token);

        Assert.Empty(await DevicesAsync(mila.Id));
        Assert.Equal(token, Assert.Single(await DevicesAsync(luka.Id)).ExpoToken);
    }

    [Fact]
    public async Task Removing_a_device_removes_only_your_own()
    {
        var mila = await app.UserAsync();
        var luka = await app.UserAsync();
        var milas = NewToken();
        var lukas = NewToken();
        await RegisterAsync(mila, milas);
        await RegisterAsync(luka, lukas);

        Assert.Equal(HttpStatusCode.NoContent, (await mila.Http.DeleteAsync($"/api/me/devices/{Uri.EscapeDataString(lukas)}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await mila.Http.DeleteAsync($"/api/me/devices/{Uri.EscapeDataString(milas)}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await mila.Http.DeleteAsync($"/api/me/devices/{Uri.EscapeDataString(milas)}")).StatusCode);

        Assert.Empty(await DevicesAsync(mila.Id));
        Assert.Single(await DevicesAsync(luka.Id));
    }

    [Theory]
    [InlineData("not-a-token", "ios")]
    [InlineData("", "ios")]
    [InlineData("ExponentPushToken[abc]", "windows")]
    public async Task A_bad_token_or_platform_is_refused(string token, string platform)
    {
        var user = await app.UserAsync();

        var response = await RegisterAsync(user, token, platform);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty(await DevicesAsync(user.Id));
    }

    [Fact]
    public async Task Deleting_the_account_removes_its_devices()
    {
        var user = await app.UserAsync();
        await RegisterAsync(user, NewToken());

        (await user.Http.DeleteAsync("/api/auth/account")).EnsureSuccessStatusCode();

        Assert.Empty(await DevicesAsync(user.Id));
    }

    // ── sending ──

    [Fact]
    public async Task A_push_reaches_every_device_of_the_user_in_batches_of_100()
    {
        var expo = new StubExpo();
        using var host = PushHost(expo);
        var user = await app.UserAsync();
        var tokens = Enumerable.Range(0, 150).Select(_ => NewToken()).ToList();
        await AddDevicesAsync(user.Id, tokens);

        await PushAsync(host, new Push([user.Id], "scanned", "You're in.", "+150 Glow at Monkey", new { bookingId = Guid.Empty, glowPoints = 150 }));

        Assert.Equal([100, 50], expo.Requests.Select(r => r.Body.GetArrayLength()));
        Assert.All(expo.Requests, r => Assert.Equal("https://exp.host/--/api/v2/push/send", r.Url.ToString()));
        Assert.Equal(tokens.Order(), expo.Messages.Select(m => m.GetProperty("to").GetString()!).Order());
        var message = expo.Messages.First();
        Assert.Equal("You're in.", message.GetProperty("title").GetString());
        Assert.Equal("+150 Glow at Monkey", message.GetProperty("body").GetString());
        var data = message.GetProperty("data");
        Assert.Equal("scanned", data.GetProperty("type").GetString());
        Assert.Equal(150, data.GetProperty("glowPoints").GetInt32());
        Assert.Equal(Guid.Empty, data.GetProperty("bookingId").GetGuid());
    }

    [Fact]
    public async Task Data_always_has_the_type_and_a_push_with_no_data_still_sends_it()
    {
        var expo = new StubExpo();
        using var host = PushHost(expo);
        var user = await app.UserAsync();
        await AddDevicesAsync(user.Id, [NewToken()]);

        await PushAsync(host, new Push([user.Id], "friend_request", "Mila wants to be friends", ""));

        var message = Assert.Single(expo.Messages);
        Assert.Equal("friend_request", message.GetProperty("data").GetProperty("type").GetString());
        Assert.Equal("Mila wants to be friends", message.GetProperty("title").GetString());
    }

    [Fact]
    public async Task Sending_does_not_wait_for_Expo()
    {
        var expo = new StubExpo();
        using var host = PushHost(expo);
        var user = await app.UserAsync();
        await AddDevicesAsync(user.Id, [NewToken()]);

        await host.Services.GetRequiredService<INotifier>().SendAsync(new Push([user.Id], "scanned", "You're in.", ""));

        Assert.Empty(expo.Requests); // queued; the worker sends it
        Assert.Equal(1, await host.Services.GetRequiredService<PushWorker>().RunOnceAsync());
        Assert.Single(expo.Requests);
    }

    [Fact]
    public async Task A_switched_off_category_is_not_sent_and_transactional_always_is()
    {
        var expo = new StubExpo();
        using var host = PushHost(expo);
        var quiet = await app.UserAsync();
        var keen = await app.UserAsync();
        var quietToken = NewToken();
        var keenToken = NewToken();
        await AddDevicesAsync(quiet.Id, [quietToken]);
        await AddDevicesAsync(keen.Id, [keenToken]);
        await app.SetUserAsync(quiet.Id, u => { u.NotifyVenues = false; u.NotifyFriends = false; u.NotifyNights = false; });

        foreach (var category in new[] { NotifyCategory.Venues, NotifyCategory.Friends, NotifyCategory.Nights })
            await PushAsync(host, new Push([quiet.Id, keen.Id], "party_published", "Monkey: Neon Friday", "", Category: category));

        Assert.Equal(3, expo.Messages.Count(m => m.GetProperty("to").GetString() == keenToken));
        Assert.DoesNotContain(expo.Messages, m => m.GetProperty("to").GetString() == quietToken);

        await PushAsync(host, new Push([quiet.Id], "hold_ending", "Your spot at Monkey", "Held until 00:30.", Category: NotifyCategory.Transactional));
        Assert.Contains(expo.Messages, m => m.GetProperty("to").GetString() == quietToken);
    }

    [Fact]
    public async Task DeviceNotRegistered_removes_that_token_only()
    {
        var expo = new StubExpo();
        using var host = PushHost(expo);
        var user = await app.UserAsync();
        var gone = NewToken();
        var alive = NewToken();
        await AddDevicesAsync(user.Id, [gone, alive]);
        expo.Dead.Add(gone);

        await PushAsync(host, new Push([user.Id], "scanned", "You're in.", ""));

        Assert.Equal(alive, Assert.Single(await DevicesAsync(user.Id)).ExpoToken);
    }

    [Fact]
    public async Task With_no_device_nothing_is_sent()
    {
        var expo = new StubExpo();
        using var host = PushHost(expo);
        var user = await app.UserAsync();

        await PushAsync(host, new Push([user.Id], "scanned", "You're in.", ""));

        Assert.Empty(expo.Requests);
    }

    [Fact]
    public async Task With_push_switched_off_nothing_is_sent()
    {
        var expo = new StubExpo();
        using var host = PushHost(expo, new() { ["Push:Enabled"] = "false" });
        var user = await app.UserAsync();
        await AddDevicesAsync(user.Id, [NewToken()]);

        await PushAsync(host, new Push([user.Id], "scanned", "You're in.", ""));

        Assert.Empty(expo.Requests);
    }

    [Fact]
    public async Task The_access_token_is_sent_when_set()
    {
        var expo = new StubExpo();
        using var host = PushHost(expo, new() { ["Push:AccessToken"] = "test-access-token" });
        var user = await app.UserAsync();
        await AddDevicesAsync(user.Id, [NewToken()]);

        await PushAsync(host, new Push([user.Id], "scanned", "You're in.", ""));

        Assert.Equal("Bearer test-access-token", Assert.Single(expo.Requests).Authorization);
    }

    [Fact]
    public async Task A_failing_Expo_is_logged_and_swallowed_and_the_next_push_still_goes()
    {
        var expo = new StubExpo { FailWith = HttpStatusCode.InternalServerError };
        using var host = PushHost(expo);
        var user = await app.UserAsync();
        var token = NewToken();
        await AddDevicesAsync(user.Id, [token]);

        await PushAsync(host, new Push([user.Id], "scanned", "One", ""));
        expo.FailWith = null;
        expo.Unreachable = true;
        await PushAsync(host, new Push([user.Id], "scanned", "Two", ""));
        expo.Unreachable = false;
        await PushAsync(host, new Push([user.Id], "scanned", "Three", ""));

        Assert.Equal(["One", "Two", "Three"], expo.Messages.Select(m => m.GetProperty("title").GetString()));
        Assert.Single(await DevicesAsync(user.Id)); // a failure is not a dead token
    }
}
