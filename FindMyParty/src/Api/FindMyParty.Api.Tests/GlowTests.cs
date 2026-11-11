using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FindMyParty.Api.Bookings;
using FindMyParty.Api.Common;
using FindMyParty.Api.Glow;
using FindMyParty.Api.Identity;
using FindMyParty.Api.Parties;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Xunit;

namespace FindMyParty.Api.Tests;

/// <summary>Helpers for the Glow tests: venues, scans at a chosen moment, Glow totals.</summary>
public static class GlowKit
{
    /// <summary>A wall-clock time in Podgorica as UTC.</summary>
    public static DateTime Local(int year, int month, int day, int hour, int minute = 0) =>
        CityClock.Utc(new DateTime(year, month, day, hour, minute, 0), "podgorica");

    public record Venue(Actor Host, Guid Id);

    public static async Task<Venue> VenueAsync(this TestApp app)
    {
        var host = await app.HostAsync();
        var id = host.Id.ToString();
        return new Venue(host, await app.WithDb(db => db.VenueProfiles.Where(v => v.UserId == id).Select(v => v.Id).SingleAsync()));
    }

    public record Scan(Guid BookingId, Guid PartyId, GlowAward? Award);

    /// <summary>
    /// A party at the venue around `at`, a booking of the guest's, a door scan at `at`, and the Glow listener told,
    /// as PassService does after a real scan. The party ends at `endsAt` (default: four hours after the scan).
    /// </summary>
    public static async Task<Scan> ScanAsync(this TestApp app, Guid guest, Venue venue, DateTime at,
        string genre = "Techno", DateTime? endsAt = null, decimal price = 5, int tickets = 1)
    {
        var party = await app.PartyAsync(venue, at.AddHours(-1), endsAt ?? at.AddHours(4), genre, price);
        var booking = await app.WithDb(async db =>
        {
            var b = new Booking(guest, party, tickets, price, Guid.NewGuid().ToString(), endsAt ?? at.AddHours(4));
            db.Bookings.Add(b);
            db.Entry(b).Property(x => x.CheckedInCount).CurrentValue = tickets;
            db.Entry(b).Property(x => x.FirstCheckedInAt).CurrentValue = at;
            db.Entry(b).Property(x => x.Status).CurrentValue = BookingStatus.Confirmed;
            await db.SaveChangesAsync();
            return b.Id;
        });
        var checkIn = Guid.NewGuid();
        await app.WithDb(async db =>
        {
            db.CheckIns.Add(new CheckIn { Id = checkIn, BookingId = booking, PartyId = party, Admitted = tickets, At = at, ByUserId = venue.Host.Id, GuestUserId = guest });
            return await db.SaveChangesAsync();
        });
        var award = await app.TellAsync(new CheckInEvent(checkIn, booking, party, venue.Id, guest, tickets, at, true));
        return new Scan(booking, party, award);
    }

    /// <summary>Tells the registered Glow listener about a scan, the way the API does after a check-in commits.</summary>
    public static async Task<GlowAward?> TellAsync(this TestApp app, CheckInEvent e)
    {
        using var scope = app.Services.CreateScope();
        var listener = scope.ServiceProvider.GetServices<ICheckInListener>().OfType<GlowAwarder>().Single();
        await listener.OnCheckedInAsync(e, CancellationToken.None);
        return await scope.ServiceProvider.GetRequiredService<GlowService>().AwardForAsync(e.GuestUserId, e.BookingId, CancellationToken.None);
    }

    /// <summary>A published party at the venue, written straight to the database so it can lie anywhere in time.</summary>
    public static Task<Guid> PartyAsync(this TestApp app, Venue venue, DateTime startsAt, DateTime endsAt, string genre = "Techno", decimal price = 5) =>
        app.WithDb(async db =>
        {
            var party = new Party(venue.Host.Id, venue.Id, new PartyRequest
            {
                Title = "Glow night", Description = "", Price = price, Capacity = 100, StartsAt = startsAt, EndsAt = endsAt,
                Latitude = 42.44, Longitude = 19.26, Genre = genre,
            });
            db.Parties.Add(party);
            db.Entry(party).Property(p => p.Status).CurrentValue = PartyStatus.Published;
            await db.SaveChangesAsync();
            return party.Id;
        });

    public static Task SetGlowAsync(this TestApp app, Guid userId, int lifetime, int? balance = null) =>
        app.WithDb(db => db.Users.Where(u => u.Id == userId.ToString())
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.GlowLifetime, lifetime).SetProperty(u => u.GlowBalance, balance ?? lifetime)));

    public static Task<(int Lifetime, int Balance)> GlowOfAsync(this TestApp app, Guid userId) =>
        app.WithDb(async db => await db.Users.Where(u => u.Id == userId.ToString())
            .Select(u => new ValueTuple<int, int>(u.GlowLifetime, u.GlowBalance)).SingleAsync());

    public static Task<string> UserNameAsync(this TestApp app, Guid userId) =>
        app.WithDb(async db => (await db.Users.Where(u => u.Id == userId.ToString()).Select(u => u.UserName).SingleAsync())!);

    public static async Task<Actor> WithRoleAsync(this TestApp app, string role)
    {
        var actor = await app.UserAsync();
        using (var scope = app.Services.CreateScope())
        {
            var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            await users.AddToRoleAsync((await users.FindByIdAsync(actor.Id.ToString()))!, role);
        }
        return await app.LoginAsync(actor.Email);
    }

    public static async Task<string?> CodeOf(HttpResponseMessage response)
    {
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return body.TryGetProperty("code", out var code) ? code.GetString() : null;
    }

    public static string[] Parts(GlowAward? award) => award!.Parts.Select(p => $"{p.Kind} {p.Points}").ToArray();

    /// <summary>"scan 100, streak 25 | 2": the parts and the streak, for one comparison.</summary>
    public static string Shape(GlowAward? award) => $"{string.Join(", ", Parts(award))} | {award!.StreakWeeks}";
}

/// <summary>Glow at the scan, totals, standing, badges, last nights, referral (spec §2.3 "Glow").</summary>
[Collection("api")]
public class GlowTests(TestApp app)
{
    [Fact]
    public async Task A_first_scan_before_midnight_at_a_new_venue_pays_check_in_early_and_first_time_and_a_return_pays_the_check_in_only()
    {
        var venue = await app.VenueAsync();
        var guest = await app.UserAsync();

        // Thursday nights: no weekend, so no streak.
        var first = await app.ScanAsync(guest.Id, venue, GlowKit.Local(2026, 11, 12, 22, 0));
        var again = await app.ScanAsync(guest.Id, venue, GlowKit.Local(2026, 11, 20, 1, 0)); // Thursday the 19th's night, after midnight

        Assert.Equal(["scan 100", "beforeMidnight 25", "firstAtVenue 50"], GlowKit.Parts(first.Award));
        Assert.Equal(175, first.Award!.Points);
        Assert.Equal(["check-in", "before midnight", "first time here"], first.Award.Parts.Select(p => p.Label));
        Assert.Equal(["scan 100"], GlowKit.Parts(again.Award));
        Assert.Equal((275, 275), await app.GlowOfAsync(guest.Id));
    }

    [Fact]
    public async Task At_0559_a_scan_belongs_to_the_night_before_and_is_after_midnight_at_0600_it_is_a_new_night()
    {
        var venue = await app.VenueAsync();
        var guest = await app.UserAsync();

        var late = await app.ScanAsync(guest.Id, venue, GlowKit.Local(2026, 11, 19, 5, 59));
        var early = await app.ScanAsync(guest.Id, venue, GlowKit.Local(2026, 11, 26, 6, 0));

        Assert.DoesNotContain("beforeMidnight 25", GlowKit.Parts(late.Award));
        Assert.Contains("beforeMidnight 25", GlowKit.Parts(early.Award));
        var nights = await app.WithDb(db => db.Set<GlowEntry>().Where(e => e.UserId == guest.Id && e.Kind == GlowKinds.Scan)
            .OrderBy(e => e.At).Select(e => e.NightDate).ToListAsync());
        Assert.Equal([new DateOnly(2026, 11, 18), new DateOnly(2026, 11, 26)], nights);
    }

    [Fact]
    public async Task First_time_at_a_venue_pays_once_per_venue()
    {
        var (monkey, kula) = (await app.VenueAsync(), await app.VenueAsync());
        var guest = await app.UserAsync();

        var a = await app.ScanAsync(guest.Id, monkey, GlowKit.Local(2026, 11, 10, 23, 0));
        var b = await app.ScanAsync(guest.Id, kula, GlowKit.Local(2026, 11, 11, 23, 0));
        var c = await app.ScanAsync(guest.Id, monkey, GlowKit.Local(2026, 11, 12, 23, 0));

        Assert.Contains("firstAtVenue 50", GlowKit.Parts(a.Award));
        Assert.Contains("firstAtVenue 50", GlowKit.Parts(b.Award));
        Assert.DoesNotContain("firstAtVenue 50", GlowKit.Parts(c.Award));
    }

    [Fact]
    public async Task The_streak_pays_from_the_second_weekend_and_the_whole_scan_counts_one_and_a_half_from_the_fourth()
    {
        var venue = await app.VenueAsync();
        var guest = await app.UserAsync();

        var w1 = await app.ScanAsync(guest.Id, venue, GlowKit.Local(2026, 10, 23, 23, 0));
        var w2 = await app.ScanAsync(guest.Id, venue, GlowKit.Local(2026, 10, 31, 1, 0)); // Friday the 30th's night
        var w3 = await app.ScanAsync(guest.Id, venue, GlowKit.Local(2026, 11, 7, 23, 0)); // Saturday
        var w4 = await app.ScanAsync(guest.Id, venue, GlowKit.Local(2026, 11, 13, 23, 47));
        var w4again = await app.ScanAsync(guest.Id, venue, GlowKit.Local(2026, 11, 14, 23, 0)); // same weekend

        Assert.Equal("scan 100, beforeMidnight 25, firstAtVenue 50 | 1", GlowKit.Shape(w1.Award));
        Assert.Equal("scan 100, streak 25 | 2", GlowKit.Shape(w2.Award));
        Assert.Equal("scan 100, beforeMidnight 25, streak 25 | 3", GlowKit.Shape(w3.Award));
        Assert.Equal("scan 100, beforeMidnight 25, streak 25, multiplier 75 | 4", GlowKit.Shape(w4.Award));
        Assert.Equal(225, w4.Award!.Points);
        Assert.Equal("×1.5 streak bonus", w4.Award.Parts[^1].Label);
        // The streak is paid once a weekend; the ×1.5 on every scan (125 × 1.5, the half rounded up).
        Assert.Equal(["scan 100", "beforeMidnight 25", "multiplier 63"], GlowKit.Parts(w4again.Award));
        Assert.Equal(175 + 125 + 150 + 225 + 188, (await app.GlowOfAsync(guest.Id)).Lifetime);
    }

    [Fact]
    public async Task A_weekend_missed_breaks_the_streak()
    {
        var venue = await app.VenueAsync();
        var guest = await app.UserAsync();

        await app.ScanAsync(guest.Id, venue, GlowKit.Local(2026, 10, 23, 23, 0));
        var after = await app.ScanAsync(guest.Id, venue, GlowKit.Local(2026, 11, 6, 23, 0)); // the 30th was skipped

        Assert.Equal("scan 100, beforeMidnight 25 | 1", GlowKit.Shape(after.Award));
    }

    private record PassBody(Guid BookingId, string Secret);

    private static async Task<string> CodeAsync(Actor guest, Guid booking)
    {
        var pass = (await guest.Http.GetFromJsonAsync<PassBody>($"/api/bookings/{booking}/pass"))!;
        return PassCode.Format(pass.BookingId, PassCode.Compute(pass.Secret, PassCode.StepAt(DateTime.UtcNow)));
    }

    [Fact]
    public async Task A_real_scan_pays_once_pushes_the_award_and_the_award_can_be_read_back()
    {
        var venue = await app.VenueAsync();
        var created = await venue.Host.Http.PostAsJsonAsync("/api/parties", TestApp.PartyBody(capacity: 10));
        var party = (await created.Content.ReadFromJsonAsync<TestApp.IdBody>())!.Id;
        (await venue.Host.Http.PostAsync($"/api/parties/{party}/publish", null)).EnsureSuccessStatusCode();
        var guest = await app.UserAsync();
        var booking = await guest.BookedAsync(party, tickets: 3);

        Assert.Equal(HttpStatusCode.NotFound, (await guest.Http.GetAsync($"/api/me/glow/awards?bookingId={booking}")).StatusCode);
        (await venue.Host.Http.PostAsJsonAsync("/api/checkins", new { code = await CodeAsync(guest, booking), admit = 1 })).EnsureSuccessStatusCode();
        (await venue.Host.Http.PostAsJsonAsync("/api/checkins", new { code = await CodeAsync(guest, booking) })).EnsureSuccessStatusCode();

        var award = await guest.Http.GetFromJsonAsync<GlowAward>($"/api/me/glow/awards?bookingId={booking}");
        Assert.Equal((booking, venue.Id, "Test venue"), (award!.BookingId, award.VenueId, award.VenueName));
        Assert.Contains("scan 100", GlowKit.Parts(award));
        Assert.Contains("firstAtVenue 50", GlowKit.Parts(award));
        Assert.Equal(award.Points, (await app.GlowOfAsync(guest.Id)).Lifetime); // the second scan paid nothing

        var push = Assert.Single(app.Notifier.SentTo(guest.Id, "scanned"));
        Assert.Equal(("You're in.", $"+{award.Points} Glow at Test venue", NotifyCategory.Transactional), (push.Title, push.Body, push.Category));
        var data = Assert.IsType<ScannedPushData>(push.Data);
        Assert.Equal((booking, award.Points), (data.BookingId, data.Award.Points));
        Assert.Equal(HttpStatusCode.NotFound, (await guest.Http.GetAsync($"/api/me/glow/awards?bookingId={Guid.NewGuid()}")).StatusCode);
    }

    [Fact]
    public async Task The_same_scan_told_twice_pays_once()
    {
        var venue = await app.VenueAsync();
        var guest = await app.UserAsync();
        var scan = await app.ScanAsync(guest.Id, venue, GlowKit.Local(2026, 11, 12, 22, 0));
        var checkIn = await app.WithDb(db => db.CheckIns.Where(c => c.BookingId == scan.BookingId).Select(c => c.Id).SingleAsync());

        await app.TellAsync(new CheckInEvent(checkIn, scan.BookingId, scan.PartyId, venue.Id, guest.Id, 1, GlowKit.Local(2026, 11, 12, 22, 0), true));
        await app.TellAsync(new CheckInEvent(Guid.NewGuid(), scan.BookingId, scan.PartyId, venue.Id, guest.Id, 1, GlowKit.Local(2026, 11, 12, 22, 30), false));

        Assert.Equal((175, 175), await app.GlowOfAsync(guest.Id));
        Assert.Single(app.Notifier.SentTo(guest.Id, "scanned"));
    }

    private class FakeGuestPasses(Guid guestPassId, Guid bookingId, Guid holderId) : IGuestPassIds
    {
        public Task<Guid?> BookingIdAsync(Guid id, Guid holder, CancellationToken ct) =>
            Task.FromResult(id == guestPassId && holder == holderId ? bookingId : (Guid?)null);

        public Task<Guid?> GuestPassIdAsync(Guid booking, Guid holder, CancellationToken ct) =>
            Task.FromResult(booking == bookingId && holder == holderId ? guestPassId : (Guid?)null);
    }

    [Fact]
    public async Task A_guest_pass_holder_earns_their_own_glow_and_finds_the_award_and_the_push_by_the_guest_pass_id()
    {
        var venue = await app.VenueAsync();
        var (booker, guest) = (await app.UserAsync(), await app.UserAsync());
        var at = GlowKit.Local(2026, 11, 12, 22, 0);
        var party = await app.PartyAsync(venue, at.AddHours(-1), at.AddHours(4));
        var booking = await app.WithDb(async db =>
        {
            var b = new Booking(booker.Id, party, 2, 5, Guid.NewGuid().ToString(), at.AddHours(4));
            db.Bookings.Add(b);
            await db.SaveChangesAsync();
            return b.Id;
        });
        var guestPassId = Guid.NewGuid();
        using var host = app.WithServices(s =>
        {
            s.RemoveAll<IGuestPassIds>();
            s.AddScoped<IGuestPassIds>(_ => new FakeGuestPasses(guestPassId, booking, guest.Id));
        });
        using (var scope = host.Services.CreateScope())
            await scope.ServiceProvider.GetServices<ICheckInListener>().OfType<GlowAwarder>().Single()
                .OnCheckedInAsync(new CheckInEvent(Guid.NewGuid(), booking, party, venue.Id, guest.Id, 1, at, true), CancellationToken.None);
        var http = host.CreateClient();
        http.DefaultRequestHeaders.Authorization = guest.Http.DefaultRequestHeaders.Authorization;

        var byPass = await http.GetFromJsonAsync<GlowAward>($"/api/me/glow/awards?bookingId={guestPassId}");
        var byBooking = await http.GetFromJsonAsync<GlowAward>($"/api/me/glow/awards?bookingId={booking}");

        Assert.Equal((guestPassId, 175), (byPass!.BookingId, byPass.Points));
        Assert.Equal((booking, 175), (byBooking!.BookingId, byBooking.Points));
        Assert.Equal((175, 0), ((await app.GlowOfAsync(guest.Id)).Lifetime, (await app.GlowOfAsync(booker.Id)).Lifetime));
        var data = Assert.IsType<ScannedPushData>(Assert.Single(app.Notifier.SentTo(guest.Id, "scanned")).Data);
        Assert.Equal((guestPassId, guestPassId), (data.BookingId, data.Award.BookingId));
        Assert.Empty(app.Notifier.SentTo(booker.Id, "scanned"));
    }

    [Fact]
    public async Task The_default_guest_pass_lookup_finds_nothing_for_an_unknown_pass()
    {
        using var scope = app.Services.CreateScope();
        var ids = scope.ServiceProvider.GetRequiredService<IGuestPassIds>();
        Assert.IsType<ModelGuestPassIds>(ids);
        Assert.Null(await ids.BookingIdAsync(Guid.NewGuid(), Guid.NewGuid(), CancellationToken.None));
    }

    // ── standing ──

    [Theory]
    [InlineData(0, "Spark", 1, "Ember", 300, 0.0, 0.0)]
    [InlineData(299, "Spark", 1, "Ember", 1, 0.9967, 0.2492)]
    [InlineData(300, "Ember", 2, "Flame", 700, 0.3, 0.25)]
    [InlineData(1240, "Flame", 3, "Blaze", 760, 0.62, 0.56)]
    [InlineData(4000, "Inferno", 5, null, null, 1.0, 1.0)]
    public async Task The_summary_places_a_lifetime_total_on_the_ladder(int lifetime, string level, int number, string? next, int? toNext, double ring, double ladder)
    {
        var guest = await app.UserAsync();
        await app.SetGlowAsync(guest.Id, lifetime, balance: 10);

        var summary = (await guest.Http.GetFromJsonAsync<GlowSummary>("/api/me/glow"))!;

        Assert.Equal((lifetime, 10), (summary.Lifetime, summary.Balance));
        Assert.Equal((level, number), (summary.Level.Name, summary.Level.Number));
        Assert.Equal((next, toNext), (summary.Next?.Name, summary.ToNext));
        Assert.Equal(ring, summary.Ring, 4);
        Assert.Equal(ladder, summary.Ladder, 4);
        Assert.Equal(["Spark", "Ember", "Flame", "Blaze", "Inferno"], summary.Levels.Select(l => l.Name));
        Assert.Equal(4, summary.MultiplierFromWeek);
        Assert.Equal(["first-night", "before-midnight", "explorer", "brought-a-friend", "regular"], summary.Badges.Select(b => b.Id));
        Assert.All(summary.Badges, b => Assert.False(b.Earned));
        Assert.Empty(summary.LastNights);
    }

    [Fact]
    public async Task The_glow_endpoints_need_a_sign_in()
    {
        var anonymous = app.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/me/glow")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/me/perks")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/me/nights")).StatusCode);
    }

    [Fact]
    public async Task Badges_streak_nights_and_venues_follow_the_scans_and_regular_is_kept_once_earned()
    {
        var venues = new List<GlowKit.Venue>();
        for (var i = 0; i < 5; i++) venues.Add(await app.VenueAsync());
        var guest = await app.UserAsync();

        // Four weekends in a row, the last with two venues; one Thursday; five venues in all.
        await app.ScanAsync(guest.Id, venues[0], GlowKit.Local(2026, 10, 24, 1, 0));
        await app.ScanAsync(guest.Id, venues[1], GlowKit.Local(2026, 10, 30, 23, 0));
        await app.ScanAsync(guest.Id, venues[2], GlowKit.Local(2026, 11, 5, 23, 0));
        await app.ScanAsync(guest.Id, venues[2], GlowKit.Local(2026, 11, 7, 1, 0));
        await app.ScanAsync(guest.Id, venues[3], GlowKit.Local(2026, 11, 13, 23, 0));
        await app.ScanAsync(guest.Id, venues[4], GlowKit.Local(2026, 11, 14, 2, 0));

        GlowSummary summary;
        using (app.Clock.At(GlowKit.Local(2026, 11, 17, 12, 0))) // the Tuesday after: last weekend still counts
            summary = (await guest.Http.GetFromJsonAsync<GlowSummary>("/api/me/glow"))!;

        Assert.Equal(4, summary.StreakWeeks);
        Assert.Equal(5, summary.NightsOut); // two scans on the 13th's night are one night
        Assert.Equal(5, summary.VenuesLit);
        Assert.Equal(venues.Select(v => v.Id).OrderBy(x => x), summary.VenuesLitIds.OrderBy(x => x));
        var badges = summary.Badges.ToDictionary(b => b.Id);
        Assert.Equal((true, 1, 1), (badges["first-night"].Earned, badges["first-night"].Have, badges["first-night"].Need));
        Assert.Equal((true, "Before midnight", "Scanned in before midnight"), (badges["before-midnight"].Earned, badges["before-midnight"].Label, badges["before-midnight"].Hint));
        Assert.Equal((true, 5, 5), (badges["explorer"].Earned, badges["explorer"].Have, badges["explorer"].Need));
        Assert.Equal((false, 0), (badges["brought-a-friend"].Earned, badges["brought-a-friend"].Have));
        Assert.Equal((true, "Regular", "Four weekends in a row"), (badges["regular"].Earned, badges["regular"].Label, badges["regular"].Hint));

        // A month later the streak is gone; the badge stays.
        using (app.Clock.At(GlowKit.Local(2026, 12, 16, 12, 0)))
            summary = (await guest.Http.GetFromJsonAsync<GlowSummary>("/api/me/glow"))!;
        Assert.Equal(0, summary.StreakWeeks);
        Assert.True(summary.Badges.Single(b => b.Id == "regular").Earned);
    }

    [Fact]
    public async Task On_a_Saturday_with_no_scan_yet_the_streak_still_counts_from_last_weekend_and_on_a_Monday_after_a_missed_one_it_is_zero()
    {
        var venue = await app.VenueAsync();
        var guest = await app.UserAsync();
        await app.ScanAsync(guest.Id, venue, GlowKit.Local(2026, 10, 30, 23, 0));
        await app.ScanAsync(guest.Id, venue, GlowKit.Local(2026, 11, 6, 23, 0));

        using (app.Clock.At(GlowKit.Local(2026, 11, 14, 20, 0)))
            Assert.Equal(2, (await guest.Http.GetFromJsonAsync<GlowSummary>("/api/me/glow"))!.StreakWeeks);
        using (app.Clock.At(GlowKit.Local(2026, 11, 16, 20, 0)))
            Assert.Equal(0, (await guest.Http.GetFromJsonAsync<GlowSummary>("/api/me/glow"))!.StreakWeeks);
    }

    [Fact]
    public async Task Last_nights_are_newest_first_with_the_venue_and_the_points_of_each_scan()
    {
        var (a, b) = (await app.VenueAsync(), await app.VenueAsync());
        var guest = await app.UserAsync();
        var older = await app.ScanAsync(guest.Id, a, GlowKit.Local(2026, 11, 3, 22, 0));
        var newer = await app.ScanAsync(guest.Id, b, GlowKit.Local(2026, 11, 4, 0, 30));

        var nights = (await guest.Http.GetFromJsonAsync<GlowSummary>("/api/me/glow"))!.LastNights;

        Assert.Equal([newer.BookingId, older.BookingId], nights.Select(n => n.BookingId));
        Assert.Equal(("Scanned in at Test venue", "Test venue", 150, new DateOnly(2026, 11, 3)), (nights[0].Title, nights[0].VenueName, nights[0].Points, nights[0].Date));
        Assert.Equal(175, nights[1].Points);
    }

    // ── referral ──

    [Fact]
    public async Task Whoever_invited_a_guest_gets_200_once_when_that_guest_is_first_scanned()
    {
        var venue = await app.VenueAsync();
        var inviter = await app.UserAsync();
        var guest = await app.UserAsync();
        var handle = await app.UserNameAsync(inviter.Id);

        var set = await guest.Http.PostAsJsonAsync("/api/me/referrer", new { handle = "@" + handle.ToUpperInvariant() });
        Assert.Equal(HttpStatusCode.NoContent, set.StatusCode);
        await app.ScanAsync(guest.Id, venue, GlowKit.Local(2026, 11, 13, 23, 0));
        await app.ScanAsync(guest.Id, venue, GlowKit.Local(2026, 11, 20, 23, 0));

        Assert.Equal((200, 200), await app.GlowOfAsync(inviter.Id));
        var push = Assert.Single(app.Notifier.SentTo(inviter.Id, "referral"));
        Assert.Equal(("+200 Glow", NotifyCategory.Friends), (push.Title, push.Category));
        Assert.EndsWith("'s first night out", push.Body);
        var summary = (await inviter.Http.GetFromJsonAsync<GlowSummary>("/api/me/glow"))!;
        Assert.True(summary.Badges.Single(b => b.Id == "brought-a-friend").Earned);
        Assert.Empty(summary.LastNights); // a referral is not a night out of the inviter's
    }

    [Fact]
    public async Task A_referrer_is_refused_when_unknown_oneself_or_too_late()
    {
        var venue = await app.VenueAsync();
        var inviter = await app.UserAsync();
        var handle = await app.UserNameAsync(inviter.Id);

        var guest = await app.UserAsync();
        var unknown = await guest.Http.PostAsJsonAsync("/api/me/referrer", new { handle = "nobody-" + Guid.NewGuid().ToString("N")[..8] });
        var self = await guest.Http.PostAsJsonAsync("/api/me/referrer", new { handle = await app.UserNameAsync(guest.Id) });
        Assert.Equal((HttpStatusCode.NotFound, "referrer_unknown"), (unknown.StatusCode, await GlowKit.CodeOf(unknown)));
        Assert.Equal((HttpStatusCode.BadRequest, "referrer_self"), (self.StatusCode, await GlowKit.CodeOf(self)));

        (await guest.Http.PostAsJsonAsync("/api/me/referrer", new { handle })).EnsureSuccessStatusCode();
        var again = await guest.Http.PostAsJsonAsync("/api/me/referrer", new { handle });
        Assert.Equal((HttpStatusCode.Conflict, "referrer_late"), (again.StatusCode, await GlowKit.CodeOf(again)));

        var scanned = await app.UserAsync();
        await app.ScanAsync(scanned.Id, venue, GlowKit.Local(2026, 11, 13, 23, 0));
        var afterScan = await scanned.Http.PostAsJsonAsync("/api/me/referrer", new { handle });
        Assert.Equal((HttpStatusCode.Conflict, "referrer_late"), (afterScan.StatusCode, await GlowKit.CodeOf(afterScan)));

        var old = await app.UserAsync();
        await app.WithDb(db => db.Users.Where(u => u.Id == old.Id.ToString()).ExecuteUpdateAsync(s => s.SetProperty(u => u.CreatedAt, DateTime.UtcNow.AddDays(-8))));
        var tooOld = await old.Http.PostAsJsonAsync("/api/me/referrer", new { handle });
        Assert.Equal((HttpStatusCode.Conflict, "referrer_late"), (tooOld.StatusCode, await GlowKit.CodeOf(tooOld)));
    }

    // ── account deletion ──

    [Fact]
    public async Task Deleting_an_account_removes_its_glow_claims_and_recap_links()
    {
        var venue = await app.VenueAsync();
        var guest = await app.UserAsync();
        await app.ScanAsync(guest.Id, venue, GlowKit.Local(2026, 11, 13, 23, 0));
        (await guest.Http.PostAsync("/api/me/nights/2026-11-13/share", null)).EnsureSuccessStatusCode();
        var invited = await app.UserAsync();
        (await invited.Http.PostAsJsonAsync("/api/me/referrer", new { handle = await app.UserNameAsync(guest.Id) })).EnsureSuccessStatusCode();

        (await guest.Http.DeleteAsync("/api/auth/account")).EnsureSuccessStatusCode();

        Assert.False(await app.WithDb(db => db.Set<GlowEntry>().AnyAsync(e => e.UserId == guest.Id)));
        Assert.False(await app.WithDb(db => db.Set<RecapShare>().AnyAsync(e => e.UserId == guest.Id)));
        Assert.Null(await app.WithDb(db => db.Users.Where(u => u.Id == invited.Id.ToString()).Select(u => u.ReferredByUserId).SingleAsync()));
    }
}
