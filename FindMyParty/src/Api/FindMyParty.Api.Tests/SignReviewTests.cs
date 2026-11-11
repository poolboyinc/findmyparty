using System.Net;
using System.Net.Http.Json;
using FindMyParty.Api.Signs;
using Xunit;

namespace FindMyParty.Api.Tests;

/// <summary>The platform admin: the review queue, brand signs, invoices and the spots.</summary>
[Collection("api")]
public class SignReviewTests(TestApp app)
{
    private static async Task<List<AdminSignDto>> QueueAsync(Actor admin, string status = "pendingReview") =>
        (await admin.Http.GetFromJsonAsync<List<AdminSignDto>>($"/api/admin/signs?status={status}"))!;

    [Fact]
    public async Task A_booking_waits_in_the_queue_with_who_where_and_what_and_approving_puts_it_up_and_tells_the_host()
    {
        var admin = await app.AdminAsync();
        var (host, _) = await app.HostInAsync();
        var spot = await admin.SpotAsync();
        var party = await app.PublishedPartyAsync(host);
        var sign = await host.BookedSignAsync(SignKit.Sign(spotId: spot.Id, partyId: party));
        var hostName = await app.UserNameAsync(host);

        var waiting = (await QueueAsync(admin)).Single(s => s.Id == sign.Id);
        Assert.Equal(("pendingReview", "NEON|FRIDAY", "Neon Friday", hostName, 40m), (waiting.Status, waiting.Text, waiting.PartyTitle, waiting.BookedBy, waiting.Price));
        Assert.Equal(waiting.VenueName, waiting.AdvertiserName);
        Assert.StartsWith("Venue ", waiting.VenueName);
        Assert.Equal(spot.Id, waiting.Spot!.Id);
        Assert.DoesNotContain(await app.CreateClient().MapAsync(), s => s.Id == sign.Id);

        Assert.Equal(HttpStatusCode.NoContent, (await admin.Http.PostAsync($"/api/admin/signs/{sign.Id}/approve", null)).StatusCode);

        Assert.DoesNotContain(await QueueAsync(admin), s => s.Id == sign.Id);
        Assert.Contains(await QueueAsync(admin, "approved"), s => s.Id == sign.Id);
        Assert.Contains(await app.CreateClient().MapAsync(), s => s.Id == sign.Id);
        var push = Assert.Single(app.Notifier.SentTo(host.Id, "sign_reviewed"));
        Assert.Equal("Your sign is live", push.Title);
        Assert.Equal(HttpStatusCode.NoContent, (await admin.Http.PostAsync($"/api/admin/signs/{sign.Id}/approve", null)).StatusCode); // twice: once told
        Assert.Single(app.Notifier.SentTo(host.Id, "sign_reviewed"));
    }

    [Fact]
    public async Task Rejecting_says_why_frees_the_spot_and_cannot_be_approved_after()
    {
        var admin = await app.AdminAsync();
        var (host, _) = await app.HostInAsync();
        var spot = await admin.SpotAsync();
        var sign = await host.BookedSignAsync(SignKit.Sign(spotId: spot.Id));

        (await admin.Http.PostAsJsonAsync($"/api/admin/signs/{sign.Id}/reject", new { note = "The artwork is too dark." })).EnsureSuccessStatusCode();

        var push = Assert.Single(app.Notifier.SentTo(host.Id, "sign_reviewed"));
        Assert.Equal(("Your sign was not approved", "The artwork is too dark."), (push.Title, push.Body));
        var mine = (await host.SignOptionsAsync()).Mine.Single(m => m.Id == sign.Id);
        Assert.Equal(("rejected", "The artwork is too dark."), (mine.Status, mine.ReviewNote));
        Assert.True((await host.SignOptionsAsync()).Spots.Single(s => s.Id == spot.Id).Free);
        var approve = await admin.Http.PostAsync($"/api/admin/signs/{sign.Id}/approve", null);
        Assert.Equal((HttpStatusCode.Conflict, "sign_not_pending"), (approve.StatusCode, (await approve.ProblemAsync()).Code));
    }

    [Fact]
    public async Task A_live_sign_can_still_be_taken_down()
    {
        var admin = await app.AdminAsync();
        var (host, _) = await app.HostInAsync();
        var sign = await host.BookedSignAsync(SignKit.Sign(spotId: (await admin.SpotAsync()).Id));
        await admin.ApproveSignAsync(sign.Id);

        (await admin.Http.PostAsJsonAsync($"/api/admin/signs/{sign.Id}/reject", new { note = "Complaint from a neighbour." })).EnsureSuccessStatusCode();

        Assert.DoesNotContain(await app.CreateClient().MapAsync(), s => s.Id == sign.Id);
    }

    [Fact]
    public async Task A_brand_sign_from_the_admin_is_up_at_once_and_nobody_is_told()
    {
        var admin = await app.AdminAsync();
        var spot = await admin.SpotAsync(format: "hologram");

        var response = await admin.Http.PostAsJsonAsync("/api/admin/signs", new
        {
            format = "hologram", spotId = spot.Id, text = "AURA|SPRITZ", colorTop = "#ffb020", colorBottom = "#ffb020", ink = "#ffb020", advertiserName = "AURA",
        });

        var sign = (await response.Content.ReadFromJsonAsync<SignBookingDto>())!;
        Assert.Equal(("approved", "toInvoice", 90m), (sign.Status, sign.InvoiceStatus, sign.Price));
        var onMap = (await app.CreateClient().MapAsync()).Single(s => s.Id == sign.Id);
        Assert.Equal(("hologram", "AURA", "AURA", false), (onMap.Format, onMap.Advertiser, onMap.Card.Title, onMap.Own));
        Assert.Equal(await app.UserNameAsync(admin), (await QueueAsync(admin, "approved")).Single(s => s.Id == sign.Id).BookedBy);
        Assert.Empty(app.Notifier.SentTo(admin.Id, "sign_reviewed"));
    }

    [Fact]
    public async Task A_brand_sign_needs_an_advertiser()
    {
        var admin = await app.AdminAsync();
        var spot = await admin.SpotAsync();

        var response = await admin.Http.PostAsJsonAsync("/api/admin/signs", new { format = "facade", spotId = spot.Id, text = "VOLT", colorTop = "#ffd23c", colorBottom = "#ff7a18", ink = "#1a0a00" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Marking_a_sign_invoiced()
    {
        var admin = await app.AdminAsync();
        var (host, _) = await app.HostInAsync();
        var sign = await host.BookedSignAsync(SignKit.Sign(spotId: (await admin.SpotAsync()).Id));

        Assert.Equal(HttpStatusCode.NoContent, (await admin.Http.PostAsync($"/api/admin/signs/{sign.Id}/invoiced", null)).StatusCode);

        Assert.Equal("invoiced", (await QueueAsync(admin)).Single(s => s.Id == sign.Id).InvoiceStatus);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.Http.PostAsync($"/api/admin/signs/{Guid.NewGuid()}/invoiced", null)).StatusCode);
    }

    [Fact]
    public async Task The_admin_makes_and_changes_spots()
    {
        var admin = await app.AdminAsync();
        var spot = await admin.SpotAsync(price: 50);

        var duplicate = await admin.Http.PostAsJsonAsync("/api/admin/sign-spots", SignKit.SpotBody("podgorica", "facade", spot.Number));
        var unknownCity = await admin.Http.PostAsJsonAsync("/api/admin/sign-spots", SignKit.SpotBody("atlantis", "facade", 1));
        var edited = await admin.Http.PutAsJsonAsync($"/api/admin/sign-spots/{spot.Id}", SignKit.SpotBody("podgorica", "facade", spot.Number, price: null, active: false));

        Assert.Equal((50m, true), (spot.WeeklyPrice, spot.Free));
        Assert.Equal(HttpStatusCode.BadRequest, duplicate.StatusCode);
        Assert.Equal("city_unknown", (await unknownCity.ProblemAsync()).Code);
        var after = (await edited.Content.ReadFromJsonAsync<SignSpotDto>())!;
        Assert.Equal((40m, false), (after.WeeklyPrice, after.Free)); // the setting's price again; switched off
        Assert.Contains((await admin.Http.GetFromJsonAsync<List<SignSpotDto>>("/api/admin/sign-spots"))!, s => s.Id == spot.Id && !s.Free);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.Http.PutAsJsonAsync($"/api/admin/sign-spots/{Guid.NewGuid()}", SignKit.SpotBody("podgorica", "facade", 99999999))).StatusCode);
    }

    [Fact]
    public async Task Only_the_admin_reviews_and_makes_spots()
    {
        var (host, _) = await app.HostInAsync();
        var user = await app.UserAsync();

        foreach (var actor in new[] { host, user })
        {
            Assert.Equal(HttpStatusCode.Forbidden, (await actor.Http.GetAsync("/api/admin/signs")).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await actor.Http.PostAsync($"/api/admin/signs/{Guid.NewGuid()}/approve", null)).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await actor.Http.PostAsJsonAsync("/api/admin/sign-spots", SignKit.SpotBody("podgorica", "facade", 1))).StatusCode);
        }
    }
}
