using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FindMyParty.Api.Bookings;
using FindMyParty.Api.Cities;
using FindMyParty.Api.Data;
using FindMyParty.Api.Identity;
using FindMyParty.Api.Parties;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace FindMyParty.Api.Tests;

[Collection("api")]
public class CityTests(TestApp app)
{
    [Theory]
    [InlineData(0, 0)]
    [InlineData(9, 0)]
    [InlineData(49, 40)]
    [InlineData(50, 50)]
    [InlineData(99, 50)]
    [InlineData(999, 950)]
    [InlineData(1000, 1000)]
    [InlineData(1234, 1200)]
    public void The_crowd_out_tonight_is_rounded_down_so_it_reads_as_at_least(int inside, int shown)
    {
        Assert.Equal(shown, CityPulse.RoundDown(inside));
    }

    /// <summary>The API on an empty database of its own, so the city totals are exact.</summary>
    private WebApplicationFactory<Program> Empty() =>
        app.With(new() { ["ConnectionStrings:DefaultConnection"] = app.ConnectionStringFor("cities_" + Guid.NewGuid().ToString("N")[..10]) });

    [Fact]
    public async Task The_cities_come_in_order_with_their_place_and_tonights_pulse()
    {
        using var api = Empty();
        var now = DateTime.UtcNow;
        using (var scope = api.Services.CreateScope())
        {
            var s = scope.ServiceProvider;
            var busy = await VenueAsync(s, "budva", 42.29, 18.84);
            var quiet = await VenueAsync(s, "budva", 42.291, 18.841);
            await VenueAsync(s, "budva", 42.292, 18.842); // nothing on
            var elsewhere = await VenueAsync(s, "kotor", 42.42, 18.77);

            var running = await PartyAsync(s, busy, now.AddHours(-2), now.AddHours(3), passes: 80);
            await ScanAsync(s, running, 37); // 67 inside reads as "50+"
            await ScanAsync(s, running, 30);
            await PartyAsync(s, quiet, now.AddHours(-1), now.AddHours(3), passes: 40);          // passes out, nobody in yet
            var over = await PartyAsync(s, elsewhere, now.AddHours(-9), now.AddHours(-1), passes: 40); // ended
            await ScanAsync(s, over, 20);
        }

        var cities = (await api.CreateClient().GetFromJsonAsync<JsonElement>("/api/cities")).EnumerateArray().ToList();

        Assert.Equal(["podgorica", "budva", "niksic", "kotor", "tivat", "herceg-novi"], cities.Select(c => c.GetProperty("slug").GetString()));
        var podgorica = cities[0];
        Assert.Equal(("Podgorica", 42.4419, 19.2632, 12.0),
            (podgorica.GetProperty("name").GetString(), podgorica.GetProperty("latitude").GetDouble(), podgorica.GetProperty("longitude").GetDouble(), podgorica.GetProperty("radiusKm").GetDouble()));
        var budva = cities[1];
        Assert.Equal((50, 1, 3), (budva.GetProperty("outTonight").GetInt32(), budva.GetProperty("venuesLit").GetInt32(), budva.GetProperty("venueCount").GetInt32()));
        var kotor = cities[3];
        Assert.Equal((0, 0, 1), (kotor.GetProperty("outTonight").GetInt32(), kotor.GetProperty("venuesLit").GetInt32(), kotor.GetProperty("venueCount").GetInt32()));
        Assert.Equal((0, 0, 0), (podgorica.GetProperty("outTonight").GetInt32(), podgorica.GetProperty("venuesLit").GetInt32(), podgorica.GetProperty("venueCount").GetInt32()));
    }

    [Fact]
    public async Task The_cities_need_no_sign_in()
    {
        Assert.Equal(HttpStatusCode.OK, (await app.CreateClient().GetAsync("/api/cities")).StatusCode);
    }

    // ── building blocks on a database of its own ──

    private static async Task<Guid> VenueAsync(IServiceProvider s, string city, double lat, double lng)
    {
        var users = s.GetRequiredService<UserManager<ApplicationUser>>();
        var name = "h" + Guid.NewGuid().ToString("N")[..10];
        var host = new ApplicationUser { UserName = name, Email = name + "@example.test" };
        Assert.True((await users.CreateAsync(host)).Succeeded);
        var db = s.GetRequiredService<AppDbContext>();
        var venue = new VenueProfile { Id = Guid.NewGuid(), UserId = host.Id, VenueName = name, Address = "Somewhere 1", Latitude = lat, Longitude = lng, CitySlug = city };
        db.VenueProfiles.Add(venue);
        await db.SaveChangesAsync();
        return venue.Id;
    }

    private static async Task<Guid> PartyAsync(IServiceProvider s, Guid venueId, DateTime startsAt, DateTime endsAt, int passes)
    {
        var db = s.GetRequiredService<AppDbContext>();
        var venue = await db.VenueProfiles.FindAsync(venueId);
        var party = new Party(Guid.Parse(venue!.UserId), venueId, new PartyRequest
        {
            Title = "Tonight", Description = "", Price = 5, Capacity = 300, StartsAt = startsAt, EndsAt = endsAt, Latitude = venue.Latitude, Longitude = venue.Longitude,
        });
        db.Parties.Add(party);
        db.Entry(party).Property(p => p.Status).CurrentValue = PartyStatus.Published;
        db.Entry(party).Property(p => p.TicketsSold).CurrentValue = passes;
        await db.SaveChangesAsync();
        return party.Id;
    }

    private static async Task ScanAsync(IServiceProvider s, Guid partyId, int guests)
    {
        var db = s.GetRequiredService<AppDbContext>();
        var party = await db.Parties.FindAsync(partyId);
        var booking = new Booking(Guid.NewGuid(), partyId, guests, 5, Guid.NewGuid().ToString(), party!.EndsAt);
        db.Bookings.Add(booking);
        db.Entry(booking).Property(b => b.CheckedInCount).CurrentValue = guests;
        db.Entry(booking).Property(b => b.Status).CurrentValue = BookingStatus.Confirmed;
        db.CheckIns.Add(new CheckIn { Id = Guid.NewGuid(), BookingId = booking.Id, PartyId = partyId, Admitted = guests, At = DateTime.UtcNow, ByUserId = party.HostId, GuestUserId = Guid.NewGuid() });
        await db.SaveChangesAsync();
    }
}
