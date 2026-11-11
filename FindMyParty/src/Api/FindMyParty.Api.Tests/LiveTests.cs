using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace FindMyParty.Api.Tests;

/// <summary>The host's live numbers (S-22): money taken, new faces, arrivals, and where the venue's beam stands in the city.</summary>
[Collection("api")]
public class LiveTests(TestApp app)
{
    private record Arrival(DateTime From, int Count);
    private record Beam(int Rank, int Of, string Level, string? LeaderName, string? RunnerUpName);
    private record Live(string PartyTitle, string Status, int Capacity, int PassesOut, int CheckedIn, int NotHereYet, decimal TakenAtDoor,
        List<Arrival> Arrivals, int NewFaces, Beam? Beam);

    private static async Task<Live> LiveAsync(Actor host, Guid party) => (await host.Http.GetFromJsonAsync<Live>($"/api/parties/{party}/live"))!;

    private async Task ScanInAsync(Actor host, Actor guest, Guid party, int tickets)
    {
        var booking = await guest.BookedAsync(party, tickets);
        (await host.Http.ScanAsync((await guest.PassAsync(booking)).Code())).EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Taken_at_the_door_is_what_each_scan_collected_after_perks()
    {
        var host = await app.HostAsync();
        var party = await app.PublishedPartyAsync(host, capacity: 50, price: 5);
        var withPerk = await app.UserAsync();
        using (var priced = app.WithPricer(new FakePricer { Answer = DoorKit.FreeBeforeMidnight() }))
        {
            var booking = await priced.As(withPerk).BookedOnAsync(party, 2);
            (await host.Http.ScanAsync((await withPerk.PassAsync(booking)).Code())).EnsureSuccessStatusCode();
        }
        await ScanInAsync(host, await app.UserAsync(), party, 2);

        var live = await LiveAsync(host, party);

        Assert.Equal((4, 4, 15m), (live.PassesOut, live.CheckedIn, live.TakenAtDoor)); // 5 (perk) + 10
    }

    [Fact]
    public async Task New_faces_are_guests_never_scanned_in_at_this_venue_before()
    {
        var host = await app.HostAsync();
        var lastWeek = await app.PublishedPartyAsync(host, capacity: 50);
        var tonight = await app.PublishedPartyAsync(host, capacity: 50);
        var regular = await app.UserAsync();
        await ScanInAsync(host, regular, lastWeek, 1);
        await ScanInAsync(host, regular, tonight, 2);
        await ScanInAsync(host, await app.UserAsync(), tonight, 3);

        var live = await LiveAsync(host, tonight);

        Assert.Equal((5, 3), (live.CheckedIn, live.NewFaces));
    }

    [Fact]
    public async Task The_beam_ranks_the_citys_venues_on_now_by_guests_inside_and_names_only_the_first_two()
    {
        var city = "test-" + Guid.NewGuid().ToString("N")[..8];
        var venues = new List<(Actor Host, Guid Party)>();
        foreach (var (name, inside) in new[] { ("Kula", 4), ("Monkey", 6), ("Atlas", 1) })
        {
            var host = await app.HostAsync();
            var hostId = host.Id.ToString();
            await app.WithDb(db => db.VenueProfiles.Where(v => v.UserId == hostId)
                .ExecuteUpdateAsync(s => s.SetProperty(v => v.CitySlug, city).SetProperty(v => v.VenueName, name)));
            var party = await app.PublishedPartyAsync(host, capacity: 50);
            await app.SetTimesAsync(party, DateTime.UtcNow.AddHours(-1), DateTime.UtcNow.AddHours(4));
            await ScanInAsync(host, await app.UserAsync(), party, inside);
            venues.Add((host, party));
        }

        var kula = (await LiveAsync(venues[0].Host, venues[0].Party)).Beam!;
        var monkey = (await LiveAsync(venues[1].Host, venues[1].Party)).Beam!;
        var atlas = (await LiveAsync(venues[2].Host, venues[2].Party)).Beam!;

        Assert.Equal((1, 3, "Monkey", "Kula"), (monkey.Rank, monkey.Of, monkey.LeaderName, monkey.RunnerUpName));
        Assert.Equal((2, 3), (kula.Rank, kula.Of));
        Assert.Equal((3, "quiet"), (atlas.Rank, atlas.Level));
    }

    [Fact]
    public async Task Venues_with_the_same_crowd_are_ranked_by_name()
    {
        var city = "test-" + Guid.NewGuid().ToString("N")[..8];
        var ranks = new Dictionary<string, int>();
        var parties = new List<(string Name, Actor Host, Guid Party)>();
        foreach (var name in new[] { "Zeta", "Alfa" })
        {
            var host = await app.HostAsync();
            var hostId = host.Id.ToString();
            await app.WithDb(db => db.VenueProfiles.Where(v => v.UserId == hostId)
                .ExecuteUpdateAsync(s => s.SetProperty(v => v.CitySlug, city).SetProperty(v => v.VenueName, name)));
            var party = await app.PublishedPartyAsync(host, capacity: 50);
            await app.SetTimesAsync(party, DateTime.UtcNow.AddHours(-1), DateTime.UtcNow.AddHours(4));
            parties.Add((name, host, party));
        }
        foreach (var (name, host, party) in parties) ranks[name] = (await LiveAsync(host, party)).Beam!.Rank;

        Assert.Equal((1, 2), (ranks["Alfa"], ranks["Zeta"]));
    }

    [Fact]
    public async Task There_is_no_beam_while_the_party_is_not_on()
    {
        var host = await app.HostAsync();
        var party = await app.PublishedPartyAsync(host); // starts in four hours

        var live = await LiveAsync(host, party);

        Assert.Equal("upcoming", live.Status);
        Assert.Null(live.Beam);
    }

    [Fact]
    public async Task An_ended_party_shows_its_last_two_hours_in_eight_quarters()
    {
        var host = await app.HostAsync();
        var party = await app.PublishedPartyAsync(host, capacity: 50);
        var start = DateTime.UtcNow.AddHours(-2);
        await app.SetTimesAsync(party, start, DateTime.UtcNow.AddMinutes(30));
        await ScanInAsync(host, await app.UserAsync(), party, 2);
        var end = new DateTime(DateTime.UtcNow.AddMinutes(30).Ticks / TimeSpan.TicksPerMinute * TimeSpan.TicksPerMinute, DateTimeKind.Utc);
        await app.SetTimesAsync(party, start, end);

        using var _ = app.Clock.At(end.AddHours(3));
        var live = await LiveAsync(host, party);

        Assert.Equal("ended", live.Status);
        Assert.Null(live.Beam);
        Assert.Equal(8, live.Arrivals.Count);
        Assert.True(live.Arrivals[^1].From < end && live.Arrivals[^1].From.AddMinutes(15) >= end);
        Assert.All(live.Arrivals.Zip(live.Arrivals.Skip(1)), p => Assert.Equal(TimeSpan.FromMinutes(15), p.Second.From - p.First.From));
        Assert.Equal(2, live.Arrivals.Sum(a => a.Count));
    }
}
