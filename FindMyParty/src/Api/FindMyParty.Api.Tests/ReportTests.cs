using System.Net;
using System.Net.Http.Json;
using FindMyParty.Api.Friends;
using Xunit;

namespace FindMyParty.Api.Tests;

/// <summary>Reporting a person, and what the platform admin can do about it.</summary>
[Collection("api")]
public class ReportTests(TestApp app)
{
    private static Task<HttpResponseMessage> ReportAsync(Actor me, Actor other, string reason = "harassment", string? note = null) =>
        me.Http.PostAsJsonAsync($"/api/users/{other.Id}/report", new { reason, note });

    private static async Task<List<AdminReport>> ReportsAsync(Actor admin, string status = "open") =>
        (await admin.Http.GetFromJsonAsync<List<AdminReport>>($"/api/admin/reports?status={status}"))!;

    private static Task<HttpResponseMessage> ResolveAsync(Actor admin, Guid reportId, string action) =>
        admin.Http.PostAsJsonAsync($"/api/admin/reports/{reportId}/resolve", new { action });

    [Fact]
    public async Task A_report_reaches_the_admin_with_who_why_the_note_and_the_open_count()
    {
        var (vule, ana, mila) = (await app.PersonAsync("Vule"), await app.PersonAsync("Ana"), await app.PersonAsync("Mila Perić"));
        var admin = await app.AdminAsync();

        Assert.Equal(HttpStatusCode.NoContent, (await ReportAsync(vule, mila, "harassment", "  Keeps messaging me.  ")).StatusCode);
        (await ReportAsync(ana, mila, "fakeProfile")).EnsureSuccessStatusCode();

        var mine = (await ReportsAsync(admin)).Where(r => r.Reported.UserId == mila.Id).ToList();
        Assert.Equal(2, mine.Count);
        var report = mine.Single(r => r.Reporter.UserId == vule.Id);
        Assert.Equal(("harassment", "Keeps messaging me.", "open"), (report.Reason, report.Note, report.Status));
        Assert.Equal((await app.UserNameAsync(vule), "Mila Perić", 2), (report.Reporter.Handle, report.Reported.DisplayName, report.Reported.OpenReports));
    }

    [Fact]
    public async Task Ten_reports_a_day_then_too_many()
    {
        var vule = await app.PersonAsync();
        var start = DateTime.UtcNow;
        using var _ = app.Clock.At(start);
        for (var i = 0; i < 10; i++) (await ReportAsync(vule, await app.PersonAsync(), "spam")).EnsureSuccessStatusCode();

        var refused = await ReportAsync(vule, await app.PersonAsync(), "spam");

        Assert.Equal((HttpStatusCode.TooManyRequests, "too_many"), (refused.StatusCode, (await refused.ProblemAsync()).Code));
        app.Clock.SetUtcNow(start.AddHours(24).AddMinutes(1));
        Assert.Equal(HttpStatusCode.NoContent, (await ReportAsync(vule, await app.PersonAsync(), "spam")).StatusCode);
    }

    [Fact]
    public async Task A_report_needs_a_known_reason_a_short_note_and_someone_else()
    {
        var (vule, mila) = (await app.PersonAsync(), await app.PersonAsync());

        Assert.Equal(HttpStatusCode.BadRequest, (await ReportAsync(vule, mila, "rude")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await ReportAsync(vule, mila, "other", new string('x', 501))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await ReportAsync(vule, vule)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await vule.Http.PostAsJsonAsync($"/api/users/{Guid.NewGuid()}/report", new { reason = "spam" })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await ReportAsync(vule, mila, "other", new string('x', 500))).StatusCode);
    }

    [Fact]
    public async Task Only_an_admin_sees_and_resolves_reports()
    {
        var (vule, mila) = (await app.PersonAsync(), await app.PersonAsync());
        (await ReportAsync(vule, mila)).EnsureSuccessStatusCode();
        var host = await app.HostAsync();

        Assert.Equal(HttpStatusCode.Forbidden, (await vule.Http.GetAsync("/api/admin/reports")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await host.Http.GetAsync("/api/admin/reports")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await ResolveAsync(vule, Guid.NewGuid(), "ban")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await app.CreateClient().GetAsync("/api/admin/reports")).StatusCode);
    }

    [Fact]
    public async Task Dismiss_closes_the_report_and_changes_nothing_else()
    {
        var (vule, mila) = (await app.PersonAsync(), await app.PersonAsync());
        await mila.ShareAsync();
        (await ReportAsync(vule, mila)).EnsureSuccessStatusCode();
        var admin = await app.AdminAsync();
        var report = (await ReportsAsync(admin)).Single(r => r.Reported.UserId == mila.Id);

        Assert.Equal(HttpStatusCode.NoContent, (await ResolveAsync(admin, report.Id, "dismiss")).StatusCode);

        Assert.DoesNotContain(await ReportsAsync(admin), r => r.Id == report.Id);
        Assert.Contains(await ReportsAsync(admin, "resolved"), r => r.Id == report.Id);
        var user = await app.ReadUserAsync(mila.Id);
        Assert.Equal((true, false), (user.ShareWithFriends, user.SharingSuspended));
    }

    [Fact]
    public async Task Suspending_sharing_takes_the_person_off_friends_maps_at_once_and_keeps_them_off()
    {
        var vule = await app.PersonAsync();
        var mila = await app.PersonAsync();
        await vule.BefriendAsync(mila);
        await vule.ShareAsync();
        await mila.ShareAsync();
        var (_, party, _) = await app.RunningPartyAsync("Monkey");
        await app.ScanInAsync(party, mila.Id);
        (await ReportAsync(vule, mila)).EnsureSuccessStatusCode();
        var admin = await app.AdminAsync();
        var report = (await ReportsAsync(admin)).Single(r => r.Reported.UserId == mila.Id);
        Assert.Single((await vule.Http.GetFromJsonAsync<FriendsOutResponse>("/api/friends/out?city=podgorica"))!.Venues);

        (await ResolveAsync(admin, report.Id, "suspendSharing")).EnsureSuccessStatusCode();

        Assert.Empty((await vule.Http.GetFromJsonAsync<FriendsOutResponse>("/api/friends/out?city=podgorica"))!.Venues);
        var list = await mila.FriendsOfAsync();
        Assert.Equal((false, true), (list.Sharing, list.Suspended));
        Assert.Equal(HttpStatusCode.Forbidden, (await mila.Http.PatchAsJsonAsync("/api/me/privacy", new { shareWithFriends = true })).StatusCode);
        await app.LoginAsync(mila.Email); // can still sign in
    }

    [Fact]
    public async Task A_ban_locks_the_account_ends_its_sessions_and_hides_it()
    {
        var tag = "Zn" + Guid.NewGuid().ToString("N")[..6];
        var vule = await app.PersonAsync($"{tag} Vule");
        var mila = await app.PersonAsync($"{tag} Mila");
        (await ReportAsync(vule, mila)).EnsureSuccessStatusCode();
        var admin = await app.AdminAsync();
        var report = (await ReportsAsync(admin)).Single(r => r.Reported.UserId == mila.Id);

        (await ResolveAsync(admin, report.Id, "ban")).EnsureSuccessStatusCode();

        var login = await app.CreateClient().PostAsJsonAsync("/api/auth/login", new { email = mila.Email, password = Actor.DefaultPassword });
        var refresh = await app.CreateClient().PostAsJsonAsync("/api/auth/refresh", new { userId = mila.Id.ToString(), refreshToken = mila.Tokens.RefreshToken });
        Assert.NotEqual(HttpStatusCode.OK, login.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, refresh.StatusCode);
        Assert.DoesNotContain((await vule.Http.GetFromJsonAsync<List<UserCard>>($"/api/users/search?q={tag}"))!, c => c.UserId == mila.Id);
        Assert.Equal(HttpStatusCode.NotFound, (await vule.AskAsync(mila)).StatusCode);
        var user = await app.ReadUserAsync(mila.Id);
        Assert.True(user.SharingSuspended);
        Assert.Contains(await ReportsAsync(admin, "resolved"), r => r.Id == report.Id);
    }

    [Fact]
    public async Task Resolving_needs_a_known_action_and_report()
    {
        var admin = await app.AdminAsync();
        var (vule, mila) = (await app.PersonAsync(), await app.PersonAsync());
        (await ReportAsync(vule, mila)).EnsureSuccessStatusCode();
        var report = (await ReportsAsync(admin)).Single(r => r.Reported.UserId == mila.Id);

        Assert.Equal(HttpStatusCode.BadRequest, (await ResolveAsync(admin, report.Id, "shout")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await ResolveAsync(admin, Guid.NewGuid(), "dismiss")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.Http.GetAsync("/api/admin/reports?status=maybe")).StatusCode);
    }
}
