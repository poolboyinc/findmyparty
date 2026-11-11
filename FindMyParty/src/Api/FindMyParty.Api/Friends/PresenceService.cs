using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using FindMyParty.Api.Parties;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Friends;

/// <summary>One friend the viewer may see, at the venue of their latest door scan.</summary>
public record FriendPresence(Guid UserId, string DisplayName, string Initial, DateTime At,
    Guid PartyId, Guid VenueId, string VenueName, double Latitude, double Longitude, string CitySlug);

/// <summary>
/// Where the viewer's friends are. Every privacy rule of the friends layer lives here, and every place that shows
/// a friend (the layer, "friends here" on parties and venues) asks this class, so there is one place to get it right.
/// </summary>
public class PresenceService(AppDbContext db, TimeProvider time)
{
    public const int NamesShown = 2;
    public const int InitialsShown = 3;

    private readonly Dictionary<Guid, IReadOnlyList<FriendPresence>> _cache = [];

    /// <summary>The viewer shares ("give to get") and has not been suspended.</summary>
    public async Task<bool> CanSeeFriendsAsync(Guid viewerId, CancellationToken ct)
    {
        var key = viewerId.ToString();
        return await db.Users.AnyAsync(u => u.Id == key && u.ShareWithFriends && !u.SharingSuspended, ct);
    }

    /// <summary>
    /// The viewer's friends who are out, each at one venue, earliest arrival first. Empty unless the viewer shares and is
    /// not suspended. A friend is shown only when: the friendship is accepted; neither has blocked the other; the friend
    /// shares, is not suspended and not invisible; and the friend was scanned in (as `GuestUserId`) at a party that has not
    /// ended. A friend scanned in at two parties is shown at the latest one.
    /// </summary>
    public async Task<IReadOnlyList<FriendPresence>> FriendsOutAsync(Guid viewerId, CancellationToken ct)
    {
        if (_cache.TryGetValue(viewerId, out var cached)) return cached;
        var result = await ReadAsync(viewerId, ct);
        _cache[viewerId] = result;
        return result;
    }

    private async Task<IReadOnlyList<FriendPresence>> ReadAsync(Guid viewerId, CancellationToken ct)
    {
        if (!await CanSeeFriendsAsync(viewerId, ct)) return [];
        var now = time.GetUtcNow().UtcDateTime;

        var friendIds = await db.Set<Friendship>()
            .Where(f => f.Status == Friendship.Accepted && (f.UserLowId == viewerId || f.UserHighId == viewerId))
            .Select(f => f.UserLowId == viewerId ? f.UserHighId : f.UserLowId)
            .ToListAsync(ct);
        if (friendIds.Count == 0) return [];
        var blocked = await db.Set<UserBlock>()
            .Where(b => b.BlockerId == viewerId || b.BlockedId == viewerId)
            .Select(b => b.BlockerId == viewerId ? b.BlockedId : b.BlockerId)
            .ToListAsync(ct);
        var keys = friendIds.Except(blocked).Select(id => id.ToString()).ToList();

        var sharing = await db.Users.AsNoTracking()
            .Where(u => keys.Contains(u.Id) && u.ShareWithFriends && !u.SharingSuspended && (u.InvisibleUntil == null || u.InvisibleUntil <= now))
            .Select(u => new { u.Id, u.DisplayName, u.UserName })
            .ToListAsync(ct);
        if (sharing.Count == 0) return [];
        var names = sharing.ToDictionary(u => Guid.Parse(u.Id), u => PersonName.Display(u.DisplayName, u.UserName));
        var ids = names.Keys.ToList();

        var scans = await (
            from c in db.CheckIns
            where ids.Contains(c.GuestUserId) && c.At <= now
            join p in db.Parties on c.PartyId equals p.Id
            where p.EndsAt > now && !p.IsDeleted && (p.Status == PartyStatus.Published || p.Status == PartyStatus.SoldOut) && p.VenueId != null
            join v in db.VenueProfiles on p.VenueId equals (Guid?)v.Id
            select new { c.GuestUserId, c.At, PartyId = p.Id, VenueId = v.Id, v.VenueName, v.Latitude, v.Longitude, v.CitySlug })
            .AsNoTracking().ToListAsync(ct);

        return scans
            .GroupBy(s => s.GuestUserId)
            .Select(g => g.OrderByDescending(s => s.At).First())
            .Select(s => new FriendPresence(s.GuestUserId, names[s.GuestUserId], PersonName.Initial(names[s.GuestUserId]), s.At,
                s.PartyId, s.VenueId, s.VenueName, s.Latitude, s.Longitude, s.CitySlug))
            .OrderBy(p => p.At).ThenBy(p => p.DisplayName, StringComparer.CurrentCultureIgnoreCase)
            .ToList();
    }

    /// <summary>The friends layer for one city.</summary>
    public async Task<FriendsOutResponse> LayerAsync(Guid viewerId, string city, CancellationToken ct)
    {
        if (!await CanSeeFriendsAsync(viewerId, ct)) return new FriendsOutResponse(false, 0, null, []);

        var here = (await FriendsOutAsync(viewerId, ct)).Where(p => p.CitySlug == city).ToList();
        var venues = here
            .GroupBy(p => p.VenueId)
            .Select(g =>
            {
                var first = g.First();
                return new FriendsAtVenue(g.Key, first.VenueName, first.Latitude, first.Longitude, g.Count(),
                    g.Take(InitialsShown).Select(p => new FriendAtVenue(p.UserId, p.DisplayName, p.Initial)).ToList());
            })
            .OrderByDescending(v => v.Count).ThenBy(v => v.VenueName, StringComparer.CurrentCultureIgnoreCase)
            .ToList();
        var fullest = venues.FirstOrDefault();
        var headline = fullest is null ? null : new FriendsHeadline(People.FirstName(fullest.Friends[0].DisplayName), fullest.Count - 1, fullest.VenueName);
        return new FriendsOutResponse(true, here.Count, headline, venues);
    }

    /// <summary>"Friends here" for a group of friends at one place, or null when there are none.</summary>
    public static FriendsHere? Here(IEnumerable<FriendPresence> friends)
    {
        var list = friends.ToList();
        return list.Count == 0
            ? null
            : new FriendsHere(list.Count,
                list.Take(NamesShown).Select(p => People.FirstName(p.DisplayName)).ToList(),
                list.Take(InitialsShown).Select(p => p.Initial).ToList());
    }
}
