using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using FindMyParty.Api.Common;
using FindMyParty.Api.Identity;
using FindMyParty.Api.Messaging;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Xunit;

namespace FindMyParty.Api.Tests;

/// <summary>Stands in for a Resend-compatible mail API. Nothing reaches the internet.</summary>
public class StubMail : HttpMessageHandler
{
    public record Sent(HttpMethod Method, Uri Url, string? Authorization, JsonElement Body);

    private readonly ConcurrentQueue<Sent> _sent = new();
    public IReadOnlyList<Sent> Requests => _sent.ToArray();
    public HttpStatusCode Status { get; set; } = HttpStatusCode.OK;

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        _sent.Enqueue(new Sent(request.Method, request.RequestUri!, request.Headers.Authorization?.ToString(), await request.Content!.ReadFromJsonAsync<JsonElement>(ct)));
        return new HttpResponseMessage(Status) { Content = JsonContent.Create(new { id = Guid.NewGuid() }) };
    }
}

[Collection("api")]
public class PasswordResetTests(TestApp app)
{
    private const string NewPassword = "N3w-password-for-tests";

    private Task<HttpResponseMessage> ForgotAsync(string email, HttpClient? http = null) =>
        (http ?? app.CreateClient()).PostAsJsonAsync("/api/auth/forgot-password", new { email });

    private Task<HttpResponseMessage> ResetAsync(string token, string newPassword = NewPassword) =>
        app.CreateClient().PostAsJsonAsync("/api/auth/reset-password", new { token, newPassword });

    private Task<HttpResponseMessage> LoginAsync(string email, string password) =>
        app.CreateClient().PostAsJsonAsync("/api/auth/login", new { email, password });

    private static readonly Regex Link = new(@"(https?://[^\s""<]+)/reset\?token=([A-Za-z0-9_\-]+)");

    /// <summary>Asks for a reset and reads the token out of the mail that went out.</summary>
    private async Task<string> TokenFromMailAsync(string email)
    {
        var before = app.Email.SentTo(email).Count;
        Assert.Equal(HttpStatusCode.NoContent, (await ForgotAsync(email)).StatusCode);
        var mail = app.Email.SentTo(email).Skip(before).Single();
        return Link.Match(mail.Text).Groups[2].Value;
    }

    [Fact]
    public async Task An_unknown_email_answers_the_same_and_sends_nothing()
    {
        var email = $"{Guid.NewGuid():N}@example.test";

        var response = await ForgotAsync(email);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Empty(app.Email.SentTo(email));
    }

    [Fact]
    public async Task An_empty_request_answers_the_same()
    {
        var response = await app.CreateClient().PostAsJsonAsync("/api/auth/forgot-password", new { });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task The_mail_carries_a_link_that_resets_the_password_once()
    {
        var user = await app.UserAsync();

        Assert.Equal(HttpStatusCode.NoContent, (await ForgotAsync(user.Email)).StatusCode);
        var mail = Assert.Single(app.Email.SentTo(user.Email));
        Assert.Equal("Reset your FindMyParty password", mail.Subject);
        var link = Link.Match(mail.Text);
        Assert.True(link.Success, mail.Text);
        Assert.Contains(link.Value, mail.Html);
        var token = link.Groups[2].Value;

        Assert.Equal(HttpStatusCode.NoContent, (await ResetAsync(token)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(user.Email, NewPassword)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync(user.Email, Actor.DefaultPassword)).StatusCode);

        var again = await ResetAsync(token, "An0ther-password-here");
        Assert.Equal(HttpStatusCode.BadRequest, again.StatusCode);
        Assert.Equal("reset_invalid", await again.CodeOf());
    }

    [Fact]
    public async Task Only_a_hash_of_the_token_is_stored()
    {
        var user = await app.UserAsync();

        var token = await TokenFromMailAsync(user.Email);

        var hashes = await app.WithDb(db => db.Set<PasswordReset>().Where(r => r.UserId == user.Id).Select(r => r.TokenHash).ToListAsync());
        var hash = Assert.Single(hashes);
        Assert.Equal(64, hash.Length);
        Assert.DoesNotContain(token, hash);
    }

    [Fact]
    public async Task The_link_dies_after_two_hours()
    {
        var start = DateTime.UtcNow;
        var late = await app.UserAsync();
        var inTime = await app.UserAsync();
        string lateToken, inTimeToken;
        using (app.Clock.At(start))
        {
            lateToken = await TokenFromMailAsync(late.Email);
            inTimeToken = await TokenFromMailAsync(inTime.Email);
        }

        using (app.Clock.At(start.AddHours(2).AddMinutes(-1)))
            Assert.Equal(HttpStatusCode.NoContent, (await ResetAsync(inTimeToken)).StatusCode);
        using (app.Clock.At(start.AddHours(2).AddMinutes(1)))
        {
            var response = await ResetAsync(lateToken);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("reset_invalid", await response.CodeOf());
        }
    }

    [Fact]
    public async Task An_unknown_token_is_refused()
    {
        var response = await ResetAsync("no-such-token");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("reset_invalid", await response.CodeOf());
    }

    [Fact]
    public async Task A_weak_password_is_refused_with_the_reasons_and_the_link_still_works()
    {
        var user = await app.UserAsync();
        var token = await TokenFromMailAsync(user.Email);

        var weak = await ResetAsync(token, "short");

        Assert.Equal(HttpStatusCode.BadRequest, weak.StatusCode);
        var problem = await weak.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("password_weak", problem.GetProperty("code").GetString());
        Assert.NotEmpty(problem.GetProperty("errors").EnumerateArray());
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(user.Email, Actor.DefaultPassword)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await ResetAsync(token)).StatusCode);
    }

    [Fact]
    public async Task A_reset_signs_every_device_out()
    {
        var user = await app.UserAsync();
        var tablet = await app.LoginAsync(user.Email);
        var token = await TokenFromMailAsync(user.Email);

        (await ResetAsync(token)).EnsureSuccessStatusCode();

        foreach (var refreshToken in new[] { user.Tokens.RefreshToken, tablet.Tokens.RefreshToken })
        {
            var refreshed = await app.CreateClient().PostAsJsonAsync("/api/auth/refresh", new { refreshToken });
            Assert.Equal(HttpStatusCode.Unauthorized, refreshed.StatusCode);
        }
    }

    [Fact]
    public async Task A_new_link_and_an_older_one_both_die_once_one_is_used()
    {
        var user = await app.UserAsync();
        var older = await TokenFromMailAsync(user.Email);
        var newer = await TokenFromMailAsync(user.Email);

        (await ResetAsync(newer)).EnsureSuccessStatusCode();

        Assert.Equal("reset_invalid", await (await ResetAsync(older, "An0ther-password-here")).CodeOf());
    }

    [Fact]
    public async Task An_account_made_with_Apple_can_set_a_password()
    {
        var email = $"{Guid.NewGuid():N}@example.test";
        app.ExternalAuth.Tokens["apple-" + email] = new ExternalIdentity(email, "a-" + Guid.NewGuid(), "Lena K", EmailVerified: true);
        (await app.CreateClient().PostAsJsonAsync("/api/auth/external", new { provider = "Apple", idToken = "apple-" + email })).EnsureSuccessStatusCode();

        var token = await TokenFromMailAsync(email);

        Assert.Equal(HttpStatusCode.NoContent, (await ResetAsync(token)).StatusCode);
        var signedIn = await app.LoginAsync(email, NewPassword);
        Assert.True((await signedIn.MeAsync()).GetProperty("hasPassword").GetBoolean());
    }

    [Fact]
    public async Task A_locked_out_account_can_sign_in_after_a_reset()
    {
        var user = await app.UserAsync();
        for (var i = 0; i < 5; i++) await LoginAsync(user.Email, "wrong-password-1");
        var token = await TokenFromMailAsync(user.Email);

        (await ResetAsync(token)).EnsureSuccessStatusCode();

        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(user.Email, NewPassword)).StatusCode);
    }

    // ── the page behind the link ──

    [Fact]
    public async Task The_reset_page_opens_the_app_with_the_token()
    {
        var user = await app.UserAsync();
        var token = await TokenFromMailAsync(user.Email);

        var response = await app.CreateClient().GetAsync($"/reset?token={token}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/html", response.Content.Headers.ContentType?.MediaType);
        Assert.Contains("no-store", response.Headers.CacheControl?.ToString());
        var html = await response.Content.ReadAsStringAsync();
        Assert.Contains("<meta property=\"og:title\" content=\"Reset your password\">", html);
        Assert.DoesNotContain("og:image", html);
        Assert.Contains($"findmypartymobileapp://reset-password?token={token}", html);
    }

    [Fact]
    public async Task The_reset_page_without_a_token_is_not_found()
    {
        var response = await app.CreateClient().GetAsync("/reset");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ── sending through a Resend-compatible API ──

    private WebApplicationFactory<Program> MailHost(StubMail mail, Dictionary<string, string?> settings) => app.WithServices(s =>
    {
        s.RemoveAll<IEmailSender>();
        s.AddSingleton<IEmailSender, ResendEmailSender>();
        s.AddHttpClient(ResendEmailSender.HttpClientName).ConfigurePrimaryHttpMessageHandler(() => mail);
    }, settings);

    [Fact]
    public async Task With_a_mail_key_the_mail_goes_to_the_mail_API()
    {
        var mail = new StubMail();
        using var host = MailHost(mail, new()
        {
            ["Email:ApiKey"] = "test-mail-key",
            ["Email:BaseUrl"] = "https://mail.test",
            ["Email:From"] = "FindMyParty <no-reply@example.test>",
        });
        var user = await app.UserAsync();

        Assert.Equal(HttpStatusCode.NoContent, (await ForgotAsync(user.Email, host.CreateClient())).StatusCode);

        var sent = Assert.Single(mail.Requests);
        Assert.Equal(HttpMethod.Post, sent.Method);
        Assert.Equal("https://mail.test/emails", sent.Url.ToString());
        Assert.Equal("Bearer test-mail-key", sent.Authorization);
        Assert.Equal("FindMyParty <no-reply@example.test>", sent.Body.GetProperty("from").GetString());
        Assert.Equal([user.Email], sent.Body.GetProperty("to").EnumerateArray().Select(t => t.GetString()));
        Assert.Equal("Reset your FindMyParty password", sent.Body.GetProperty("subject").GetString());
        Assert.Matches(Link, sent.Body.GetProperty("text").GetString()!);
        Assert.Matches(Link, sent.Body.GetProperty("html").GetString()!);
    }

    [Fact]
    public async Task A_mail_API_that_fails_still_answers_the_same()
    {
        var mail = new StubMail { Status = HttpStatusCode.UnprocessableEntity };
        using var host = MailHost(mail, new() { ["Email:ApiKey"] = "test-mail-key" });
        var user = await app.UserAsync();

        Assert.Equal(HttpStatusCode.NoContent, (await ForgotAsync(user.Email, host.CreateClient())).StatusCode);
        Assert.Equal("https://api.resend.com/emails", Assert.Single(mail.Requests).Url.ToString());
    }

    [Fact]
    public async Task With_no_mail_key_nothing_is_sent_and_nothing_throws()
    {
        var mail = new StubMail();
        using var resend = MailHost(mail, new() { ["Email:ApiKey"] = "" });
        using var logOnly = app.WithServices(s =>
        {
            s.RemoveAll<IEmailSender>();
            s.AddSingleton<IEmailSender, LogEmailSender>();
        });
        var user = await app.UserAsync();

        Assert.Equal(HttpStatusCode.NoContent, (await ForgotAsync(user.Email, resend.CreateClient())).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await ForgotAsync(user.Email, logOnly.CreateClient())).StatusCode);
        Assert.Empty(mail.Requests);
    }
}
