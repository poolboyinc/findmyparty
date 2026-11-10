using System.Net.Http.Headers;
using System.Net.Http.Json;
using FindMyParty.Api.Data;
using FindMyParty.Api.Identity;
using FindMyParty.Api.Parties;
using FindMyParty.Api.Storage;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Testcontainers.PostgreSql;
using Xunit;

namespace FindMyParty.Api.Tests;

/// <summary>The real API in-process against a real, throwaway Postgres. Shared by every test; tests create their own data.</summary>
public class TestApp : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder().WithImage("postgres:18-alpine").Build();
    public FakeImageStorage Images { get; } = new();
    public FakeExternalAuth ExternalAuth { get; } = new();

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();
        Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", _postgres.GetConnectionString());
        Environment.SetEnvironmentVariable("Jwt__Key", "test-signing-key-long-enough-for-hmac-sha256-0123456789");
        Environment.SetEnvironmentVariable("RateLimits__AuthPerMinute", "1000000");
        Environment.SetEnvironmentVariable("RateLimits__GeneralPerMinute", "1000000");
    }

    public new async Task DisposeAsync()
    {
        await base.DisposeAsync();
        await _postgres.DisposeAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IImageStorage>();
            services.AddSingleton<IImageStorage>(Images);
            services.RemoveAll<IExternalAuthService>();
            services.AddSingleton<IExternalAuthService>(ExternalAuth);
        });
    }

    /// <summary>The same service started again with extra settings, e.g. on its own empty database.</summary>
    public WebApplicationFactory<Program> With(Dictionary<string, string?> settings) =>
        WithWebHostBuilder(b => b.ConfigureAppConfiguration((_, c) => c.AddInMemoryCollection(settings)));

    /// <summary>A connection string for another database on the same throwaway server.</summary>
    public string ConnectionStringFor(string database) =>
        new Npgsql.NpgsqlConnectionStringBuilder(_postgres.GetConnectionString()) { Database = database }.ConnectionString;

    public async Task<T> WithDb<T>(Func<AppDbContext, Task<T>> work)
    {
        using var scope = Services.CreateScope();
        return await work(scope.ServiceProvider.GetRequiredService<AppDbContext>());
    }

    // ── people ──

    public async Task<Actor> UserAsync(string? email = null, string password = Actor.DefaultPassword)
    {
        var name = "u" + Guid.NewGuid().ToString("N")[..12];
        email ??= $"{name}@example.test";
        var response = await CreateClient().PostAsJsonAsync("/api/auth/register", new { userName = name, email, password });
        response.EnsureSuccessStatusCode();
        return await ActorFromAsync(response, email);
    }

    public async Task<Actor> HostAsync() => await WithRolesAsync(Roles.Host, withVenue: true);
    public async Task<Actor> AdminAsync() => await WithRolesAsync(Roles.Admin, withVenue: false);

    private async Task<Actor> WithRolesAsync(string role, bool withVenue)
    {
        var actor = await UserAsync();
        using (var scope = Services.CreateScope())
        {
            var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var user = await users.FindByIdAsync(actor.Id.ToString());
            await users.AddToRoleAsync(user!, role);
            if (withVenue)
            {
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                db.VenueProfiles.Add(new VenueProfile { Id = Guid.NewGuid(), UserId = user!.Id, VenueName = "Test venue", Address = "Somewhere 1", Latitude = 42.44, Longitude = 19.26 });
                await db.SaveChangesAsync();
            }
        }
        return await LoginAsync(actor.Email); // new token that carries the role
    }

    public async Task<Actor> LoginAsync(string email, string password = Actor.DefaultPassword)
    {
        var response = await CreateClient().PostAsJsonAsync("/api/auth/login", new { email, password });
        response.EnsureSuccessStatusCode();
        return await ActorFromAsync(response, email);
    }

    private async Task<Actor> ActorFromAsync(HttpResponseMessage response, string email)
    {
        var tokens = (await response.Content.ReadFromJsonAsync<LoginResponse>())!;
        var client = CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokens.AccessToken);
        var id = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler().ReadJwtToken(tokens.AccessToken).Subject;
        return new Actor(client, Guid.Parse(id), email, tokens);
    }

    // ── parties ──

    public static object PartyBody(int capacity = 10, decimal price = 5, string title = "Neon Friday") => new
    {
        title,
        description = "A party.",
        price,
        capacity,
        startsAt = DateTime.UtcNow.AddHours(4),
        endsAt = DateTime.UtcNow.AddHours(9),
        latitude = 42.4411,
        longitude = 19.2594,
        genre = "Techno",
    };

    public async Task<Guid> DraftPartyAsync(Actor host, int capacity = 10, decimal price = 5)
    {
        var created = await host.Http.PostAsJsonAsync("/api/parties", PartyBody(capacity, price));
        created.EnsureSuccessStatusCode();
        return (await created.Content.ReadFromJsonAsync<IdBody>())!.Id;
    }

    public async Task<Guid> PublishedPartyAsync(Actor host, int capacity = 10, decimal price = 5)
    {
        var id = await DraftPartyAsync(host, capacity, price);
        (await host.Http.PostAsync($"/api/parties/{id}/publish", null)).EnsureSuccessStatusCode();
        return id;
    }

    public Task<int> TicketsSoldAsync(Guid partyId) =>
        WithDb(db => db.Parties.Where(p => p.Id == partyId).Select(p => p.TicketsSold).SingleAsync());

    public record IdBody(Guid Id);
}

public record Actor(HttpClient Http, Guid Id, string Email, LoginResponse Tokens)
{
    public const string DefaultPassword = "Passw0rd-for-tests";

    public Task<HttpResponseMessage> BookAsync(Guid partyId, int tickets = 1, string? key = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/bookings") { Content = JsonContent.Create(new { partyId, ticketCount = tickets }) };
        request.Headers.Add("Idempotency-Key", key ?? Guid.NewGuid().ToString());
        return Http.SendAsync(request);
    }

    public async Task<Guid> BookedAsync(Guid partyId, int tickets = 1, string? key = null)
    {
        var response = await BookAsync(partyId, tickets, key);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<BookingIdBody>())!.BookingId;
    }

    public record BookingIdBody(Guid BookingId);
}

public class FakeImageStorage : IImageStorage
{
    public bool IsConfigured { get; set; } = true;
    public List<(string Key, string ContentType, long Bytes)> Uploads { get; } = [];

    public async Task<string> UploadAsync(Stream content, string key, string contentType, CancellationToken ct = default)
    {
        using var copy = new MemoryStream();
        await content.CopyToAsync(copy, ct);
        Uploads.Add((key, contentType, copy.Length));
        return $"https://images.test/{key}";
    }
}

public class FakeExternalAuth : IExternalAuthService
{
    /// <summary>idToken → identity. Unknown tokens are rejected, like a bad signature.</summary>
    public Dictionary<string, ExternalIdentity> Tokens { get; } = [];

    public Task<ExternalIdentity> ValidateAsync(string provider, string idToken) =>
        Tokens.TryGetValue(idToken, out var identity) ? Task.FromResult(identity) : throw new InvalidOperationException("bad token");
}

[CollectionDefinition("api")]
public class ApiCollection : ICollectionFixture<TestApp>;
