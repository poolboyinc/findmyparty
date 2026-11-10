using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FindMyParty.Api.Data;
using FindMyParty.Api.Identity;
using FindMyParty.Api.Parties;
using FindMyParty.Api.Venues;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace FindMyParty.Api.Tests;

/// <summary>Demo data for looking at the app before real venues exist. Each test gets its own empty database.</summary>
[Collection("api")]
public class DemoSeedTests(TestApp app)
{
    private WebApplicationFactory<Program> Seeded(string database, string? ownerEmail = null) => app.With(new()
    {
        ["ConnectionStrings:DefaultConnection"] = app.ConnectionStringFor(database),
        ["Seed:Demo"] = "true",
        ["Seed:OwnerEmail"] = ownerEmail,
    });

    private static string NewDatabase() => "seed_" + Guid.NewGuid().ToString("N")[..10];

    [Fact]
    public async Task Demo_mode_fills_the_city_with_venues_that_have_a_party_on_right_now()
    {
        using var seeded = Seeded(NewDatabase());

        var venues = await seeded.CreateClient().GetFromJsonAsync<List<VenueSummary>>("/api/venues?pageSize=100");

        Assert.Equal(7, venues!.Count);
        Assert.All(venues, v => Assert.NotNull(v.PartyId));
        Assert.Contains(venues, v => v is { Name: "Monkey", CrowdLevel: "200+", CrowdSource: "live" });
        Assert.Contains(venues, v => v.CrowdSource == "expected");
        Assert.True(venues.Select(v => v.CrowdLevel).Distinct().Count() >= 4, "venues should differ in how busy they are");
    }

    [Fact]
    public async Task Starting_again_does_not_duplicate_the_demo_data()
    {
        var database = NewDatabase();
        using (var first = Seeded(database)) first.CreateClient();
        using var second = Seeded(database);

        var venues = await second.CreateClient().GetFromJsonAsync<List<VenueSummary>>("/api/venues?pageSize=100");
        var parties = await second.CreateClient().GetFromJsonAsync<List<PartyResponse>>("/api/parties?pageSize=100");

        Assert.Equal(7, venues!.Count);
        Assert.Equal(parties!.Count, parties.Select(p => (p.VenueId, p.Title, p.StartsAt)).Distinct().Count());
        Assert.Equal(7, parties.Count(p => p.StartsAt <= DateTime.UtcNow)); // one running party per venue
    }

    [Fact]
    public async Task The_owner_gets_admin_rights_and_runs_the_first_demo_venue()
    {
        var database = NewDatabase();
        var email = $"owner-{Guid.NewGuid():N}@example.test";
        using (var first = Seeded(database))
            (await first.CreateClient().PostAsJsonAsync("/api/auth/register", new { userName = "owner" + Guid.NewGuid().ToString("N")[..8], email, password = Actor.DefaultPassword })).EnsureSuccessStatusCode();

        using var seeded = Seeded(database, ownerEmail: email);
        var client = seeded.CreateClient();
        var tokens = await (await client.PostAsJsonAsync("/api/auth/login", new { email, password = Actor.DefaultPassword })).Content.ReadFromJsonAsync<LoginResponse>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokens!.AccessToken);

        var venue = await client.GetFromJsonAsync<VenueProfileDto>("/api/hosts/profile");
        var mine = await client.GetFromJsonAsync<List<HostPartyResponse>>("/api/parties/mine");
        var running = mine!.First(p => p.StartsAt <= DateTime.UtcNow);
        var live = await client.GetAsync($"/api/parties/{running.Id}/live");

        Assert.Equal("Monkey", venue!.VenueName);
        Assert.Equal(HttpStatusCode.OK, live.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/users")).StatusCode);
    }

    [Fact]
    public async Task Without_demo_mode_nothing_is_added()
    {
        using var plain = app.With(new() { ["ConnectionStrings:DefaultConnection"] = app.ConnectionStringFor(NewDatabase()) });

        var venues = await plain.CreateClient().GetFromJsonAsync<List<VenueSummary>>("/api/venues?pageSize=100");

        Assert.Empty(venues!);
    }
}
