using System.Net;
using System.Net.Http.Json;
using FindMyParty.Api.Bookings;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace FindMyParty.Api.Tests;

[Collection("api")]
public class BookingTests(TestApp app)
{
    [Fact]
    public async Task Booking_holds_the_spots_on_the_party()
    {
        var party = await app.PublishedPartyAsync(await app.HostAsync(), capacity: 10);
        var guest = await app.UserAsync();

        await guest.BookedAsync(party, tickets: 3);

        Assert.Equal(3, await app.TicketsSoldAsync(party));
    }

    [Fact]
    public async Task Twenty_people_racing_for_five_spots_get_exactly_five()
    {
        var party = await app.PublishedPartyAsync(await app.HostAsync(), capacity: 5);
        var guests = await Task.WhenAll(Enumerable.Range(0, 20).Select(_ => app.UserAsync()));

        var responses = await Task.WhenAll(guests.Select(g => g.BookAsync(party)));

        Assert.Equal(5, responses.Count(r => r.StatusCode == HttpStatusCode.OK));
        Assert.Equal(15, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));
        Assert.Equal(5, await app.TicketsSoldAsync(party));
    }

    [Fact]
    public async Task Retrying_with_the_same_key_returns_the_same_booking_and_holds_spots_once()
    {
        var party = await app.PublishedPartyAsync(await app.HostAsync(), capacity: 10);
        var guest = await app.UserAsync();
        var key = Guid.NewGuid().ToString();

        var first = await guest.BookedAsync(party, tickets: 2, key);
        var retry = await guest.BookedAsync(party, tickets: 2, key);

        Assert.Equal(first, retry);
        Assert.Equal(2, await app.TicketsSoldAsync(party));
    }

    [Fact]
    public async Task The_same_key_sent_twice_at_once_still_makes_one_booking()
    {
        var party = await app.PublishedPartyAsync(await app.HostAsync(), capacity: 10);
        var guest = await app.UserAsync();
        var key = Guid.NewGuid().ToString();

        var responses = await Task.WhenAll(Enumerable.Range(0, 6).Select(_ => guest.BookAsync(party, 1, key)));

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
        Assert.Equal(1, await app.TicketsSoldAsync(party));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(7)]
    [InlineData(500)]
    public async Task One_booking_is_for_one_to_six_guests(int tickets)
    {
        var party = await app.PublishedPartyAsync(await app.HostAsync(), capacity: 1000);
        var guest = await app.UserAsync();

        var response = await guest.BookAsync(party, tickets);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, await app.TicketsSoldAsync(party));
    }

    [Fact]
    public async Task A_full_party_answers_sold_out()
    {
        var party = await app.PublishedPartyAsync(await app.HostAsync(), capacity: 2);
        await (await app.UserAsync()).BookedAsync(party, tickets: 2);

        var response = await (await app.UserAsync()).BookAsync(party);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("sold_out", (await response.Content.ReadFromJsonAsync<Problem>())!.Code);
    }

    [Fact]
    public async Task A_draft_party_cannot_be_booked()
    {
        var party = await app.DraftPartyAsync(await app.HostAsync());

        var response = await (await app.UserAsync()).BookAsync(party);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("not_bookable", (await response.Content.ReadFromJsonAsync<Problem>())!.Code);
    }

    [Fact]
    public async Task A_cancelled_party_cannot_be_booked()
    {
        var host = await app.HostAsync();
        var party = await app.PublishedPartyAsync(host);
        (await host.Http.PostAsync($"/api/parties/{party}/cancel", null)).EnsureSuccessStatusCode();

        var response = await (await app.UserAsync()).BookAsync(party);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task A_party_that_has_ended_cannot_be_booked()
    {
        var party = await app.PublishedPartyAsync(await app.HostAsync());
        await app.WithDb(db => db.Parties.Where(p => p.Id == party).ExecuteUpdateAsync(s => s
            .SetProperty(p => p.StartsAt, DateTime.UtcNow.AddHours(-6))
            .SetProperty(p => p.EndsAt, DateTime.UtcNow.AddHours(-1))));

        var response = await (await app.UserAsync()).BookAsync(party);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Booking_a_party_that_does_not_exist_is_not_found()
    {
        var response = await (await app.UserAsync()).BookAsync(Guid.NewGuid());

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Cancelling_gives_the_spots_back_once()
    {
        var party = await app.PublishedPartyAsync(await app.HostAsync(), capacity: 10);
        var guest = await app.UserAsync();
        var booking = await guest.BookedAsync(party, tickets: 4);

        var first = await guest.Http.DeleteAsync($"/api/bookings/{booking}");
        var second = await guest.Http.DeleteAsync($"/api/bookings/{booking}");

        Assert.Equal(HttpStatusCode.NoContent, first.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, second.StatusCode);
        Assert.Equal(0, await app.TicketsSoldAsync(party));
    }

    [Fact]
    public async Task Nobody_can_cancel_someone_elses_booking()
    {
        var party = await app.PublishedPartyAsync(await app.HostAsync());
        var booking = await (await app.UserAsync()).BookedAsync(party, tickets: 2);

        var response = await (await app.UserAsync()).Http.DeleteAsync($"/api/bookings/{booking}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(2, await app.TicketsSoldAsync(party));
    }

    [Fact]
    public async Task A_guest_cannot_confirm_their_own_booking()
    {
        var party = await app.PublishedPartyAsync(await app.HostAsync());
        var guest = await app.UserAsync();
        var booking = await guest.BookedAsync(party);

        var response = await guest.Http.PostAsync($"/api/bookings/{booking}/confirm", null);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(BookingStatus.Pending, await app.WithDb(db => db.Bookings.Where(b => b.Id == booking).Select(b => b.Status).SingleAsync()));
    }

    [Fact]
    public async Task The_host_of_the_party_can_confirm_a_booking()
    {
        var host = await app.HostAsync();
        var party = await app.PublishedPartyAsync(host);
        var booking = await (await app.UserAsync()).BookedAsync(party);

        var response = await host.Http.PostAsync($"/api/bookings/{booking}/confirm", null);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(BookingStatus.Confirmed, await app.WithDb(db => db.Bookings.Where(b => b.Id == booking).Select(b => b.Status).SingleAsync()));
    }

    [Fact]
    public async Task A_host_cannot_see_bookings_for_another_hosts_party()
    {
        var party = await app.PublishedPartyAsync(await app.HostAsync());
        await (await app.UserAsync()).BookedAsync(party);

        var response = await (await app.HostAsync()).Http.GetAsync($"/api/bookings/party/{party}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task My_bookings_come_with_the_party_details()
    {
        var party = await app.PublishedPartyAsync(await app.HostAsync());
        var guest = await app.UserAsync();
        await guest.BookedAsync(party, tickets: 2);

        var mine = await guest.Http.GetFromJsonAsync<List<UserBookingResponse>>("/api/bookings/my");

        var row = Assert.Single(mine!);
        Assert.Equal(2, row.TicketCount);
        Assert.Equal(0, row.CheckedInCount);
        Assert.Equal("Neon Friday", row.Party!.Title);
        Assert.Equal("Test venue", row.Party.VenueName);
    }

    private record Problem(string Title, string Code);
}
