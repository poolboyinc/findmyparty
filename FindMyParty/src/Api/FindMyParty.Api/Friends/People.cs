using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using FindMyParty.Api.Identity;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Friends;

/// <summary>How people appear to each other: who can be found at all, and the card each one gets.</summary>
public class People(AppDbContext db, TimeProvider time)
{
    private const string DemoDomain = "@" + "FINDMYPARTY.DEMO";
    private const string DemoGuestPrefix = "DEMO-GUEST-";

    /// <summary>The handle: the user name in lower case.</summary>
    public static string Handle(string? userName) => (userName ?? "").ToLowerInvariant();

    /// <summary>"Mila" for "Mila Perić": what a push or a headline calls someone.</summary>
    public static string FirstName(string displayName)
    {
        var first = displayName.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).FirstOrDefault();
        return string.IsNullOrEmpty(first) ? "Someone" : first;
    }

    /// <summary>
    /// Accounts a person may find and add: not a door login, not a demo venue's host, not a banned account.
    /// Demo guests stay findable, so the demo has people in it.
    /// </summary>
    public IQueryable<ApplicationUser> Findable()
    {
        var now = time.GetUtcNow();
        var doorRole = db.Roles.Where(r => r.Name == Roles.Door).Select(r => r.Id);
        return db.Users.Where(u =>
            !db.UserRoles.Any(ur => ur.UserId == u.Id && doorRole.Contains(ur.RoleId))
            && !(u.NormalizedEmail != null && u.NormalizedEmail.EndsWith(DemoDomain) && !u.NormalizedEmail.StartsWith(DemoGuestPrefix))
            && (u.LockoutEnd == null || u.LockoutEnd <= now));
    }

    /// <summary>The people on either side of a block with this user.</summary>
    public async Task<HashSet<Guid>> BlockedEitherWayAsync(Guid me, CancellationToken ct) =>
        (await db.Set<UserBlock>().Where(b => b.BlockerId == me || b.BlockedId == me)
            .Select(b => b.BlockerId == me ? b.BlockedId : b.BlockerId).ToListAsync(ct)).ToHashSet();

    public record Person(Guid Id, string Handle, string DisplayName, string Initial, string LevelName, bool Sharing);

    /// <summary>The people with these ids, as cards show them. Ids that do not exist are left out.</summary>
    public async Task<Dictionary<Guid, Person>> PeopleAsync(IEnumerable<Guid> ids, CancellationToken ct)
    {
        var keys = ids.Distinct().Select(id => id.ToString()).ToList();
        if (keys.Count == 0) return [];
        var rows = await db.Users.AsNoTracking().Where(u => keys.Contains(u.Id))
            .Select(u => new { u.Id, u.UserName, u.DisplayName, u.GlowLifetime, u.ShareWithFriends, u.SharingSuspended })
            .ToListAsync(ct);
        return rows.ToDictionary(u => Guid.Parse(u.Id), u =>
        {
            var name = PersonName.Display(u.DisplayName, u.UserName);
            return new Person(Guid.Parse(u.Id), Handle(u.UserName), name, PersonName.Initial(name), GlowLevels.For(u.GlowLifetime).Name,
                u.ShareWithFriends && !u.SharingSuspended);
        });
    }

    /// <summary>Cards for these people as `me` sees them: with how each one relates to me.</summary>
    public async Task<List<UserCard>> CardsAsync(Guid me, IReadOnlyList<Guid> ids, CancellationToken ct)
    {
        var people = await PeopleAsync(ids, ct);
        var edges = await db.Set<Friendship>().AsNoTracking()
            .Where(f => (f.UserLowId == me && ids.Contains(f.UserHighId)) || (f.UserHighId == me && ids.Contains(f.UserLowId)))
            .ToListAsync(ct);
        var iBlocked = (await db.Set<UserBlock>().Where(b => b.BlockerId == me && ids.Contains(b.BlockedId)).Select(b => b.BlockedId).ToListAsync(ct)).ToHashSet();

        var cards = new List<UserCard>();
        foreach (var id in ids)
        {
            if (!people.TryGetValue(id, out var p)) continue;
            var edge = edges.FirstOrDefault(f => f.Other(me) == id);
            var relation = iBlocked.Contains(id) ? Relation.Blocked
                : edge is null ? Relation.None
                : edge.Status == Friendship.Accepted ? Relation.Friend
                : edge.RequestedById == me ? Relation.Requested
                : Relation.Incoming;
            var requestId = relation is Relation.Requested or Relation.Incoming ? edge!.Id : (Guid?)null;
            cards.Add(new UserCard(p.Id, p.Handle, p.DisplayName, p.Initial, p.LevelName, relation, requestId));
        }
        return cards;
    }
}
