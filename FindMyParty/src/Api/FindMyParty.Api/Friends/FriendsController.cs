using FindMyParty.Api.Cities;
using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using FindMyParty.Api.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Friends;

/// <summary>Friends: the list, asking and answering, the privacy switches, the friends layer, reporting and blocking.</summary>
[ApiController]
[Authorize]
public class FriendsController(FriendService friends, PresenceService presence, ReportService reports, AppDbContext db) : ControllerBase
{
    [HttpGet("api/friends")]
    public async Task<FriendsList> List(CancellationToken ct)
    {
        var me = User.UserId();
        var key = me.ToString();
        var userName = await db.Users.Where(u => u.Id == key).Select(u => u.UserName).FirstOrDefaultAsync(ct);
        var inviteUrl = Links.PublicUrl(HttpContext, $"/i/{Uri.EscapeDataString(People.Handle(userName))}");
        return await friends.ListAsync(me, inviteUrl, ct);
    }

    [HttpGet("api/users/search")]
    public Task<List<UserCard>> Search([FromQuery] string? q, CancellationToken ct) => friends.SearchAsync(User.UserId(), q, ct);

    [HttpGet("api/users/by-handle/{handle}")]
    public Task<UserCard> ByHandle(string handle, CancellationToken ct) => friends.ByHandleAsync(User.UserId(), handle, ct);

    [HttpPost("api/friends/requests")]
    public async Task<IActionResult> Ask([FromBody] FriendRequestInput input, CancellationToken ct)
    {
        await friends.RequestAsync(User.UserId(), input.UserId, ct);
        return NoContent();
    }

    [HttpPost("api/friends/requests/{id:guid}/accept")]
    public async Task<IActionResult> Accept(Guid id, CancellationToken ct)
    {
        await friends.AcceptAsync(User.UserId(), id, ct);
        return NoContent();
    }

    /// <summary>Unfriend, decline or withdraw.</summary>
    [HttpDelete("api/friends/{userId:guid}")]
    public async Task<IActionResult> Remove(Guid userId, CancellationToken ct)
    {
        await friends.RemoveAsync(User.UserId(), userId, ct);
        return NoContent();
    }

    [HttpPatch("api/me/privacy")]
    public Task<PrivacyState> Privacy([FromBody] PrivacyInput input, CancellationToken ct) => friends.SetPrivacyAsync(User.UserId(), input, ct);

    /// <summary>The friends layer of one city (the account's home city when none is given).</summary>
    [HttpGet("api/friends/out")]
    public async Task<FriendsOutResponse> Out([FromQuery] string? city, CancellationToken ct)
    {
        var me = User.UserId();
        if (string.IsNullOrWhiteSpace(city))
        {
            var key = me.ToString();
            city = await db.Users.Where(u => u.Id == key).Select(u => u.HomeCity).FirstOrDefaultAsync(ct);
            if (!City.All.Any(c => c.Slug == city)) city = City.Default;
        }
        else if (!City.All.Any(c => c.Slug == city))
            throw ApiException.Invalid("That city is not on FindMyParty yet.", "city_unknown");
        return await presence.LayerAsync(me, city!, ct);
    }

    [HttpPost("api/users/{id:guid}/report")]
    public async Task<IActionResult> Report(Guid id, [FromBody] ReportInput input, CancellationToken ct)
    {
        await reports.ReportAsync(User.UserId(), id, input, ct);
        return NoContent();
    }

    [HttpPut("api/users/{id:guid}/block")]
    public async Task<IActionResult> Block(Guid id, CancellationToken ct)
    {
        await friends.BlockAsync(User.UserId(), id, ct);
        return NoContent();
    }

    [HttpDelete("api/users/{id:guid}/block")]
    public async Task<IActionResult> Unblock(Guid id, CancellationToken ct)
    {
        await friends.UnblockAsync(User.UserId(), id, ct);
        return NoContent();
    }
}

/// <summary>The platform admin's side of reports.</summary>
[ApiController]
[Authorize(Roles = Roles.Admin)]
[Route("api/admin/reports")]
public class AdminReportsController(ReportService reports) : ControllerBase
{
    [HttpGet]
    public Task<List<AdminReport>> List([FromQuery] string? status, CancellationToken ct) => reports.ListAsync(status, ct);

    [HttpPost("{id:guid}/resolve")]
    public async Task<IActionResult> Resolve(Guid id, [FromBody] ResolveInput input, CancellationToken ct)
    {
        await reports.ResolveAsync(User.UserId(), id, input, ct);
        return NoContent();
    }
}
