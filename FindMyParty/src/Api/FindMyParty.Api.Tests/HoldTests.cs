using System.Net;
using System.Net.Http.Json;
using FindMyParty.Api.Bookings;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace FindMyParty.Api.Tests;

/// <summary>The hold: a booking keeps its spots until party start + hold minutes; nobody scanned by then, they go back to the door.</summary>
[Collection("api")]
public class HoldTests(TestApp app)
{
    private record QuoteBody(DateTime HeldUntil);

    private static DateTime Minute(DateTime t) => new(t.Ticks - t.Ticks % TimeSpan.TicksPerMinute, DateTimeKind.Utc);

    /// <summary>A published party at fixed times (UTC, whole minutes) with the given hold.</summary>
    private async Task<(Actor Host, Guid Party)> PartyAsync(DateTime startsAt, DateTime endsAt, int holdMinutes = 90, int capacity = 10)
    {
        var host = await app.HostAsync();
        var party = await app.PublishedPartyAsync(host, capacity: capacity, price: 5);
        await app.SetTimesAsync(party, startsAt, endsAt);
        await app.WithDb(db => db.Parties.Where(p => p.Id == party).ExecuteUpdateAsync(s => s.SetProperty(p => p.HoldMinutes, holdMinutes)));
        return (host, party);
    }

    private async Task<DateTime> HeldUntilAsync(Actor guest, Guid party) =>
        (await guest.Http.GetFromJsonAsync<QuoteBody>($"/api/bookings/quote?partyId={party}&ticketCount=1"))!.HeldUntil;

    private HoldSweeper Sweeper => app.Services.GetRequiredService<HoldSweeper>();

    private Task<Booking> BookingAsync(Guid id) => app.WithDb(db => db.Bookings.AsNoTracking().SingleAsync(b => b.Id == id));

    [Fact]
    public async Task Booked_before_the_start_the_pass_is_held_until_the_start_plus_the_hold()
    {
        var start = Minute(DateTime.UtcNow.AddHours(4));
        var (_, party) = await PartyAsync(start, start.AddHours(5), holdMinutes: 90);

        Assert.Equal(start.AddMinutes(90), await HeldUntilAsync(await app.UserAsync(), party));
    }

    [Fact]
    public async Task Booked_after_the_start_the_pass_is_held_from_now()
    {
        var start = Minute(DateTime.UtcNow.AddHours(-1));
        var (_, party) = await PartyAsync(start, start.AddHours(6), holdMinutes: 60);
        var guest = await app.UserAsync();
        var now = Minute(DateTime.UtcNow);
        using var _ = app.Clock.At(now);

        Assert.Equal(now.AddMinutes(60), await HeldUntilAsync(guest, party));
    }

    [Fact]
    public async Task The_hold_never_runs_past_the_end_of_the_party()
    {
        var start = Minute(DateTime.UtcNow.AddHours(-1));
        var end = start.AddHours(1).AddMinutes(30);
        var (_, party) = await PartyAsync(start, end, holdMinutes: 600);

        Assert.Equal(end, await HeldUntilAsync(await app.UserAsync(), party));
    }

    [Fact]
    public void A_booking_made_without_a_hold_time_is_held_until_the_party_ends()
    {
        var ends = new DateTime(2026, 11, 14, 3, 0, 0, DateTimeKind.Utc);

        var booking = new Booking(Guid.NewGuid(), Guid.NewGuid(), 2, 5, "demo-key", ends);

        Assert.Equal(ends, booking.HeldUntil);
    }

    [Fact]
    public async Task After_the_hold_the_sweeper_expires_the_booking_gives_the_spots_back_and_takes_its_guest_passes_back()
    {
        var start = Minute(DateTime.UtcNow.AddHours(2));
        var (_, party) = await PartyAsync(start, start.AddHours(5), holdMinutes: 30, capacity: 10);
        var guest = await app.UserAsync();
        var booking = await guest.BookedAsync(party, tickets: 3);
        var guestPass = (await (await guest.Http.PostAsync($"/api/bookings/{booking}/guest-passes", null)).Content.ReadFromJsonAsync<GuestPassId>())!.Id;
        Assert.Equal(3, await app.TicketsSoldAsync(party));

        using (app.Clock.At(start.AddMinutes(30 + 1)))
            await Sweeper.RunOnceAsync(); // the hold is over, but a door without signal may still replay a scan: not yet
        Assert.Equal(BookingStatus.Pending, (await BookingAsync(booking)).Status);

        using (app.Clock.At(start.AddMinutes(30 + 16)))
        {
            await Sweeper.RunOnceAsync();
            await Sweeper.RunOnceAsync(); // a second run (or a second copy) changes nothing more
        }

        Assert.Equal(BookingStatus.Expired, (await BookingAsync(booking)).Status);
        Assert.Equal(0, await app.TicketsSoldAsync(party));
        Assert.NotNull(await app.WithDb(db => db.Set<GuestPass>().Where(g => g.Id == guestPass).Select(g => g.RevokedAt).SingleAsync()));
        var mine = (await guest.Http.GetFromJsonAsync<List<StatusRow>>("/api/bookings/my"))!.Single(b => b.Id == booking);
        Assert.Equal(("Expired", 0m), (mine.Status, mine.AmountDue));
    }

    private record GuestPassId(Guid Id);
    private record StatusRow(Guid Id, string Status, decimal AmountDue);

    [Fact]
    public async Task The_sweeper_leaves_a_booking_alone_once_someone_on_it_is_inside()
    {
        var start = Minute(DateTime.UtcNow.AddMinutes(-10));
        var (host, party) = await PartyAsync(start, start.AddHours(5), holdMinutes: 30, capacity: 10);
        var guest = await app.UserAsync();
        var booking = await guest.BookedAsync(party, tickets: 3);
        (await host.Http.ScanAsync((await guest.PassAsync(booking)).Code(), admit: 1)).EnsureSuccessStatusCode();

        using (app.Clock.At(start.AddHours(2)))
            await Sweeper.RunOnceAsync();

        Assert.Equal(BookingStatus.Confirmed, (await BookingAsync(booking)).Status);
        Assert.Equal(3, await app.TicketsSoldAsync(party));
    }

    [Fact]
    public async Task A_cancelled_booking_is_not_expired_again()
    {
        var start = Minute(DateTime.UtcNow.AddHours(1));
        var (_, party) = await PartyAsync(start, start.AddHours(5), holdMinutes: 15, capacity: 10);
        var guest = await app.UserAsync();
        var booking = await guest.BookedAsync(party, tickets: 2);
        var other = await (await app.UserAsync()).BookedAsync(party, tickets: 1);
        (await guest.Http.DeleteAsync($"/api/bookings/{booking}")).EnsureSuccessStatusCode();
        await app.WithDb(db => db.Bookings.Where(b => b.Id == other).ExecuteUpdateAsync(s => s.SetProperty(b => b.Status, BookingStatus.Confirmed)));

        using (app.Clock.At(start.AddHours(1)))
            await Sweeper.RunOnceAsync();

        Assert.Equal(BookingStatus.Cancelled, (await BookingAsync(booking)).Status);
        Assert.Equal(1, await app.TicketsSoldAsync(party));
    }

    [Fact]
    public async Task A_scan_after_the_hold_is_refused_and_says_until_when_it_was_held()
    {
        var start = Minute(DateTime.UtcNow.AddMinutes(-40));
        var (host, party) = await PartyAsync(start, start.AddHours(5), holdMinutes: 30, capacity: 10);
        var guest = await app.UserAsync();
        var booking = await guest.BookedAsync(party, tickets: 2); // booked after the start: held 30 minutes from now
        var pass = await guest.PassAsync(booking);
        var later = pass.HeldUntil!.Value.AddMinutes(1);

        using var _ = app.Clock.At(later);
        var response = await host.Http.ScanAsync(pass.Code(later));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var problem = await response.ProblemAsync();
        Assert.Equal("hold_expired", problem.Code);
        Assert.Equal(pass.HeldUntil.Value, problem.HeldUntil!.Value, TimeSpan.FromMilliseconds(1));
    }

    [Fact]
    public async Task Half_an_hour_before_the_hold_ends_the_booker_is_reminded_once()
    {
        var start = Minute(DateTime.UtcNow.AddHours(3));
        var (_, party) = await PartyAsync(start, start.AddHours(5), holdMinutes: 90);
        var guest = await app.UserAsync();
        var booking = await guest.BookedAsync(party, tickets: 2);

        using (app.Clock.At(start.AddMinutes(30)))
            await Sweeper.RunOnceAsync(); // an hour before: too early
        Assert.Empty(app.Notifier.SentTo(guest.Id, "hold_ending"));

        using (app.Clock.At(start.AddMinutes(61)))
        {
            await Sweeper.RunOnceAsync();
            await Sweeper.RunOnceAsync();
        }

        var push = Assert.Single(app.Notifier.SentTo(guest.Id, "hold_ending"));
        Assert.Equal("Your spot at Test venue", push.Title);
        var local = FindMyParty.Api.Common.CityClock.Local(start.AddMinutes(90), "podgorica");
        Assert.Equal($"Held until {local:HH:mm}. Show your pass at the door.", push.Body);
        Assert.Contains(booking.ToString(), System.Text.Json.JsonSerializer.Serialize(push.Data));
    }
}
