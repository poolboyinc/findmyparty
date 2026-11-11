using System.Net;
using System.Net.Http.Json;
using FindMyParty.Api.Bookings;
using FindMyParty.Api.Common;
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

        var mine = await guest.Http.GetFromJsonAsync<List<BookingResponse>>("/api/bookings/my");

        var row = Assert.Single(mine!);
        Assert.Equal(2, row.TicketCount);
        Assert.Equal(0, row.CheckedInCount);
        Assert.Equal("Neon Friday", row.Party!.Title);
        Assert.Equal("Test venue", row.Party.VenueName);
    }

    // ── quote, perk and what is left to pay ──

    private record QuotePerkBody(string PerkKey, string Title, int AppliesToGuests, decimal Discount, DateTime? ValidUntil);
    private record QuoteBody(Guid PartyId, int TicketCount, int MaxGuests, decimal PricePerGuest, decimal Subtotal, QuotePerkBody? Perk,
        bool SkipLine, decimal TotalAtDoor, DateTime HeldUntil, bool PayNowAvailable);
    private record MineBody(Guid Id, decimal TotalPrice, string? PerkTitle, decimal PerkDiscount, decimal AmountDue, bool SkipLine, DateTime? HeldUntil, PartyBody? Party);
    private record PartyBody(string Title, string? VenueName, string? VenueArea);

    [Fact]
    public async Task The_quote_is_the_price_with_no_perk_when_no_pricer_offers_one()
    {
        var party = await app.PublishedPartyAsync(await app.HostAsync(), capacity: 4, price: 5);
        var guest = await app.UserAsync();
        using var host = app.WithPricer(new FakePricer());

        var quote = (await host.As(guest).GetFromJsonAsync<QuoteBody>($"/api/bookings/quote?partyId={party}&ticketCount=2"))!;

        Assert.Equal((2, 4, 5m, 10m, 10m), (quote.TicketCount, quote.MaxGuests, quote.PricePerGuest, quote.Subtotal, quote.TotalAtDoor));
        Assert.Null(quote.Perk);
        Assert.False(quote.SkipLine);
        Assert.False(quote.PayNowAvailable);
    }

    [Fact]
    public async Task The_quote_is_what_the_booking_then_stores()
    {
        var party = await app.PublishedPartyAsync(await app.HostAsync(), capacity: 10, price: 5);
        var guest = await app.UserAsync();
        var validUntil = DoorKit.NextMidnight();
        var pricer = new FakePricer { Answer = DoorKit.FreeBeforeMidnight(skipLine: true) };
        using var host = app.WithPricer(pricer);
        var client = host.As(guest);

        var quote = (await client.GetFromJsonAsync<QuoteBody>($"/api/bookings/quote?partyId={party}&ticketCount=2"))!;
        var booking = await client.BookedOnAsync(party, 2);
        var stored = await app.WithDb(db => db.Bookings.SingleAsync(b => b.Id == booking));
        var mine = (await client.GetFromJsonAsync<List<MineBody>>("/api/bookings/my"))!.Single(b => b.Id == booking);

        Assert.Equal(("freeEntryBefore", "Free before midnight (you)", 1, 5m), (quote.Perk!.PerkKey, quote.Perk.Title, quote.Perk.AppliesToGuests, quote.Perk.Discount));
        Assert.Equal((10m, 5m, true), (quote.Subtotal, quote.TotalAtDoor, quote.SkipLine));
        Assert.Equal((quote.Perk.PerkKey, quote.Perk.Discount, quote.SkipLine), (stored.PerkKey, stored.PerkDiscount, stored.SkipLine));
        Assert.Equal("Free for you before midnight", stored.PerkTitle); // the pricer's wording is kept; checkout words it from the key
        Assert.Equal(quote.HeldUntil, stored.HeldUntil, TimeSpan.FromSeconds(5));
        Assert.Equal(validUntil, stored.PerkValidUntil!.Value, TimeSpan.FromMilliseconds(1));
        Assert.Equal((10m, "Free for you before midnight", 5m, 5m, true), (mine.TotalPrice, mine.PerkTitle, mine.PerkDiscount, mine.AmountDue, mine.SkipLine));
        Assert.Equal(quote.TotalAtDoor, mine.AmountDue);
    }

    [Fact]
    public async Task A_retry_with_the_same_key_does_not_ask_for_a_new_perk()
    {
        var party = await app.PublishedPartyAsync(await app.HostAsync(), capacity: 10, price: 5);
        var guest = await app.UserAsync();
        var pricer = new FakePricer { Answer = DoorKit.FreeBeforeMidnight() };
        using var host = app.WithPricer(pricer);
        var key = Guid.NewGuid().ToString();

        async Task<HttpResponseMessage> Book()
        {
            var request = new HttpRequestMessage(HttpMethod.Post, "/api/bookings") { Content = JsonContent.Create(new { partyId = party, ticketCount = 2 }) };
            request.Headers.Add("Idempotency-Key", key);
            return await host.As(guest).SendAsync(request);
        }
        (await Book()).EnsureSuccessStatusCode();
        pricer.Answer = null;
        (await Book()).EnsureSuccessStatusCode();

        Assert.Equal(1, pricer.Calls);
        Assert.Equal(2, await app.TicketsSoldAsync(party));
    }

    [Fact]
    public async Task A_quote_is_refused_like_a_booking()
    {
        var full = await app.PublishedPartyAsync(await app.HostAsync(), capacity: 2);
        await (await app.UserAsync()).BookedAsync(full, tickets: 2);
        var draft = await app.DraftPartyAsync(await app.HostAsync());
        var guest = await app.UserAsync();

        var soldOut = await guest.Http.GetAsync($"/api/bookings/quote?partyId={full}&ticketCount=1");
        var notOpen = await guest.Http.GetAsync($"/api/bookings/quote?partyId={draft}&ticketCount=1");
        var tooMany = await guest.Http.GetAsync($"/api/bookings/quote?partyId={draft}&ticketCount=7");
        var missing = await guest.Http.GetAsync($"/api/bookings/quote?partyId={Guid.NewGuid()}&ticketCount=1");
        var signedOut = await app.CreateClient().GetAsync($"/api/bookings/quote?partyId={full}&ticketCount=1");

        Assert.Equal("sold_out", (await soldOut.Content.ReadFromJsonAsync<Problem>())!.Code);
        Assert.Equal("not_bookable", (await notOpen.Content.ReadFromJsonAsync<Problem>())!.Code);
        Assert.Equal("ticket_count", (await tooMany.Content.ReadFromJsonAsync<Problem>())!.Code);
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, signedOut.StatusCode);
    }

    [Fact]
    public async Task A_booking_cannot_be_cancelled_once_someone_on_it_is_inside()
    {
        var host = await app.HostAsync();
        var party = await app.PublishedPartyAsync(host, capacity: 10);
        var guest = await app.UserAsync();
        var booking = await guest.BookedAsync(party, tickets: 3);
        (await host.Http.ScanAsync((await guest.PassAsync(booking)).Code(), admit: 1)).EnsureSuccessStatusCode();

        var response = await guest.Http.DeleteAsync($"/api/bookings/{booking}");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("guest_inside", (await response.Content.ReadFromJsonAsync<Problem>())!.Code);
        Assert.Equal(3, await app.TicketsSoldAsync(party));
    }

    [Fact]
    public async Task My_bookings_name_the_venues_area()
    {
        var host = await app.HostAsync();
        var hostId = host.Id.ToString();
        await app.WithDb(db => db.VenueProfiles.Where(v => v.UserId == hostId).ExecuteUpdateAsync(s => s.SetProperty(v => v.Area, "Stara Varoš")));
        var party = await app.PublishedPartyAsync(host);
        var guest = await app.UserAsync();
        await guest.BookedAsync(party);

        var row = Assert.Single((await guest.Http.GetFromJsonAsync<List<MineBody>>("/api/bookings/my"))!);

        Assert.Equal(("Test venue", "Stara Varoš"), (row.Party!.VenueName, row.Party.VenueArea));
    }

    private record HostRow(Guid Id, string GuestName, int CheckedInCount, DateTime? HeldUntil, decimal AmountDue, string Status);

    [Fact]
    public async Task The_host_sees_each_booking_with_the_guests_name_how_many_are_in_and_what_is_left_to_collect()
    {
        var host = await app.HostAsync();
        var party = await app.PublishedPartyAsync(host, capacity: 10, price: 5);
        var guest = await app.UserAsync();
        await app.WithDb(db => db.Users.Where(u => u.Id == guest.Id.ToString()).ExecuteUpdateAsync(s => s.SetProperty(u => u.DisplayName, "Mila Perić")));
        var booking = await guest.BookedAsync(party, tickets: 3);
        (await host.Http.ScanAsync((await guest.PassAsync(booking)).Code(), admit: 1)).EnsureSuccessStatusCode();

        var row = Assert.Single((await host.Http.GetFromJsonAsync<List<HostRow>>($"/api/bookings/party/{party}"))!);

        Assert.Equal(("Mila P.", 1, 10m, "Confirmed"), (row.GuestName, row.CheckedInCount, row.AmountDue, row.Status));
        Assert.Null(row.HeldUntil); // someone is in: the hold no longer matters
    }

    private record Problem(string Title, string Code);
}
