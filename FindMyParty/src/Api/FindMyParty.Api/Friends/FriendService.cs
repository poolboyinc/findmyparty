using FindMyParty.Api.Cities;
using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace FindMyParty.Api.Friends;

/// <summary>The friend graph: asking, accepting, removing, blocking, and the switches that decide who sees whom.</summary>
public class FriendService(AppDbContext db, People people, INotifier notifier, TimeProvider time)
{
    public const int RequestsPerDay = 30;
    public const int SearchResults = 20;

    private DateTime Now => time.GetUtcNow().UtcDateTime;

    public static ApiException TooMany() =>
        new(StatusCodes.Status429TooManyRequests, "That is enough for today. Try again tomorrow.", "too_many");

    private static ApiException Blocked() => ApiException.Conflict("You cannot add this person.", "blocked");

    // ── reading ──

    public async Task<FriendsList> ListAsync(Guid me, string inviteUrl, CancellationToken ct)
    {
        var key = me.ToString();
        var self = await db.Users.AsNoTracking().Where(u => u.Id == key)
            .Select(u => new { u.ShareWithFriends, u.SharingSuspended, u.InvisibleUntil }).FirstOrDefaultAsync(ct)
            ?? throw ApiException.NotFound("Account");

        var edges = await db.Set<Friendship>().AsNoTracking()
            .Where(f => f.UserLowId == me || f.UserHighId == me).ToListAsync(ct);
        var others = edges.Select(e => e.Other(me)).ToList();
        var cards = (await people.CardsAsync(me, others, ct)).ToDictionary(c => c.UserId);
        var persons = await people.PeopleAsync(others, ct);

        var friends = edges.Where(e => e.Status == Friendship.Accepted && persons.ContainsKey(e.Other(me)))
            .Select(e =>
            {
                var p = persons[e.Other(me)];
                return new FriendDto(p.Id, p.Handle, p.DisplayName, p.Initial, p.LevelName, e.AcceptedAt ?? e.CreatedAt, p.Sharing);
            })
            .OrderBy(f => f.DisplayName, StringComparer.CurrentCultureIgnoreCase).ToList();
        List<FriendRequestDto> Requests(bool mine) => edges
            .Where(e => e.Status == Friendship.Pending && (e.RequestedById == me) == mine && cards.ContainsKey(e.Other(me)))
            .OrderByDescending(e => e.CreatedAt)
            .Select(e => new FriendRequestDto(e.Id, cards[e.Other(me)], e.CreatedAt)).ToList();

        return new FriendsList(friends, Requests(mine: false), Requests(mine: true),
            self.ShareWithFriends && !self.SharingSuspended, StillAhead(self.InvisibleUntil), self.SharingSuspended, inviteUrl);
    }

    private DateTime? StillAhead(DateTime? until) => until is { } u && u > Now ? u : null;

    /// <summary>Handle or display name starting with the query. Never yourself, door logins, demo hosts or anyone on either side of a block.</summary>
    public async Task<List<UserCard>> SearchAsync(Guid me, string? query, CancellationToken ct)
    {
        var q = (query ?? "").Trim().TrimStart('@').Trim();
        if (q.Length is < 2 or > 30) return [];

        var key = me.ToString();
        var blocked = (await people.BlockedEitherWayAsync(me, ct)).Select(id => id.ToString()).ToList();
        var upper = q.ToUpperInvariant(); // how Identity normalises user names
        var pattern = EscapeLike(q) + "%";
        var ids = await people.Findable()
            .Where(u => u.Id != key && !blocked.Contains(u.Id))
            .Where(u => u.NormalizedUserName!.StartsWith(upper) || (u.DisplayName != null && EF.Functions.ILike(u.DisplayName, pattern, "\\")))
            .OrderBy(u => u.NormalizedUserName == upper ? 0 : 1)
            .ThenBy(u => u.NormalizedUserName)
            .Take(SearchResults)
            .Select(u => u.Id)
            .ToListAsync(ct);
        return await people.CardsAsync(me, ids.Select(Guid.Parse).ToList(), ct);
    }

    private static string EscapeLike(string s) => s.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");

    /// <summary>
    /// One person by handle. Someone who blocked me, a door login or a demo host is "not found";
    /// someone I blocked comes back with relation "blocked", so I can undo it.
    /// </summary>
    public async Task<UserCard> ByHandleAsync(Guid me, string handle, CancellationToken ct)
    {
        var id = await FindIdAsync(handle, ct) ?? throw ApiException.NotFound("Person");
        if (await db.Set<UserBlock>().AnyAsync(b => b.BlockerId == id && b.BlockedId == me, ct)) throw ApiException.NotFound("Person");
        return (await people.CardsAsync(me, [id], ct)).Single();
    }

    /// <summary>A findable account by its handle, or null.</summary>
    public async Task<Guid?> FindIdAsync(string handle, CancellationToken ct)
    {
        var upper = (handle ?? "").Trim().TrimStart('@').ToUpperInvariant();
        if (upper.Length == 0) return null;
        var id = await people.Findable().Where(u => u.NormalizedUserName == upper).Select(u => u.Id).FirstOrDefaultAsync(ct);
        return id is null ? null : Guid.Parse(id);
    }

    // ── the graph ──

    /// <summary>
    /// Asks `other` to be friends. Already friends or already asked: nothing changes. They asked first: accepted.
    /// </summary>
    public async Task RequestAsync(Guid me, Guid other, CancellationToken ct)
    {
        if (other == me) throw ApiException.Invalid("You cannot add yourself.");
        var otherKey = other.ToString();
        if (!await people.Findable().AnyAsync(u => u.Id == otherKey, ct)) throw ApiException.NotFound("Person");
        if (await db.Set<UserBlock>().AnyAsync(b => (b.BlockerId == me && b.BlockedId == other) || (b.BlockerId == other && b.BlockedId == me), ct))
            throw Blocked();

        var (low, high) = Friendship.Pair(me, other);
        var edge = await db.Set<Friendship>().FirstOrDefaultAsync(f => f.UserLowId == low && f.UserHighId == high, ct);
        if (edge is not null)
        {
            if (edge.Status == Friendship.Pending && edge.RequestedById == other) await AcceptEdgeAsync(edge, me, ct);
            return; // friends already, or my request is still waiting
        }

        var now = Now;
        var sentToday = await db.Set<FriendRequestLog>().Where(l => l.FromUserId == me && l.At > now.AddDays(-1)).ToListAsync(ct);
        if (sentToday.Count >= RequestsPerDay) throw TooMany();

        db.Set<Friendship>().Add(new Friendship
        {
            Id = Guid.NewGuid(), UserLowId = low, UserHighId = high, RequestedById = me, Status = Friendship.Pending, CreatedAt = now
        });
        db.Set<FriendRequestLog>().Add(new FriendRequestLog { Id = Guid.NewGuid(), FromUserId = me, ToUserId = other, At = now });
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // They asked me at the same moment. Their request stands; take it as the answer.
            db.ChangeTracker.Clear();
            var theirs = await db.Set<Friendship>().FirstOrDefaultAsync(f => f.UserLowId == low && f.UserHighId == high, ct);
            if (theirs is { Status: Friendship.Pending } && theirs.RequestedById == other) await AcceptEdgeAsync(theirs, me, ct);
            return;
        }

        // Asking, withdrawing and asking again rings their phone once a day at most.
        if (!sentToday.Any(l => l.ToUserId == other))
        {
            var name = await FirstNameAsync(me, ct);
            await notifier.SendAsync(new Push([other], "friend_request", $"{name} wants to be friends", "", new { userId = me }, NotifyCategory.Friends), ct);
        }
    }

    /// <summary>Accepts a request made to me. Someone else's request, or one that is gone, is "not found".</summary>
    public async Task AcceptAsync(Guid me, Guid requestId, CancellationToken ct)
    {
        var edge = await db.Set<Friendship>().FirstOrDefaultAsync(f => f.Id == requestId && (f.UserLowId == me || f.UserHighId == me), ct)
                   ?? throw ApiException.NotFound("Request");
        if (edge.Status == Friendship.Accepted) return;
        if (edge.RequestedById == me) throw ApiException.NotFound("Request"); // only the one asked may accept
        await AcceptEdgeAsync(edge, me, ct);
    }

    private async Task AcceptEdgeAsync(Friendship edge, Guid me, CancellationToken ct)
    {
        var accepted = await db.Set<Friendship>()
            .Where(f => f.Id == edge.Id && f.Status == Friendship.Pending)
            .ExecuteUpdateAsync(s => s.SetProperty(f => f.Status, Friendship.Accepted).SetProperty(f => f.AcceptedAt, Now), ct);
        if (accepted == 0) return; // accepted by a request that arrived at the same moment
        var name = await FirstNameAsync(me, ct);
        await notifier.SendAsync(new Push([edge.RequestedById], "friend_accepted", $"{name} is now your friend", "", new { userId = me }, NotifyCategory.Friends), ct);
    }

    /// <summary>Unfriend, decline or withdraw: whatever is between us goes.</summary>
    public Task RemoveAsync(Guid me, Guid other, CancellationToken ct)
    {
        var (low, high) = Friendship.Pair(me, other);
        return db.Set<Friendship>().Where(f => f.UserLowId == low && f.UserHighId == high).ExecuteDeleteAsync(ct);
    }

    public async Task BlockAsync(Guid me, Guid other, CancellationToken ct)
    {
        if (other == me) throw ApiException.Invalid("You cannot block yourself.");
        var otherKey = other.ToString();
        if (!await db.Users.AnyAsync(u => u.Id == otherKey, ct)) throw ApiException.NotFound("Person");

        // Both steps are safe to repeat, so a block that fails half-way is finished by sending it again.
        await RemoveAsync(me, other, ct);
        if (await db.Set<UserBlock>().AnyAsync(b => b.BlockerId == me && b.BlockedId == other, ct)) return;
        db.Set<UserBlock>().Add(new UserBlock { BlockerId = me, BlockedId = other, CreatedAt = Now });
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // The same block, sent twice at once.
        }
    }

    public Task UnblockAsync(Guid me, Guid other, CancellationToken ct) =>
        db.Set<UserBlock>().Where(b => b.BlockerId == me && b.BlockedId == other).ExecuteDeleteAsync(ct);

    // ── privacy ──

    /// <summary>
    /// "Show me on friends' maps" and "Invisible tonight". Invisible lasts until 12:00 on the day after tonight's
    /// night began, in the home city's time (Podgorica's when none is set).
    /// </summary>
    public async Task<PrivacyState> SetPrivacyAsync(Guid me, PrivacyInput input, CancellationToken ct)
    {
        var key = me.ToString();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == key, ct) ?? throw ApiException.NotFound("Account");
        if (input.ShareWithFriends == true && user.SharingSuspended)
            throw new ApiException(StatusCodes.Status403Forbidden, "Sharing is switched off for your account. Write to support.", "sharing_suspended");

        if (input.ShareWithFriends is { } share) user.ShareWithFriends = share;
        if (input.InvisibleTonight is { } invisible) user.InvisibleUntil = invisible ? InvisibleUntil(Now, user.HomeCity) : null;
        await db.SaveChangesAsync(ct);
        return new PrivacyState(user.ShareWithFriends && !user.SharingSuspended, StillAhead(user.InvisibleUntil));
    }

    /// <summary>12:00 local on the day after the night `now` belongs to.</summary>
    public static DateTime InvisibleUntil(DateTime now, string? homeCity)
    {
        var city = City.All.Any(c => c.Slug == homeCity) ? homeCity! : City.Default;
        var night = CityClock.NightDate(now, city);
        return CityClock.Utc(night.AddDays(1).ToDateTime(new TimeOnly(12, 0)), city);
    }

    private async Task<string> FirstNameAsync(Guid userId, CancellationToken ct) =>
        (await people.PeopleAsync([userId], ct)).TryGetValue(userId, out var p) ? People.FirstName(p.DisplayName) : "Someone";
}
