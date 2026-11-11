using System.Security.Cryptography;
using System.Text;

namespace FindMyParty.Api.Demo;

/// <summary>A demo guest: a real account nobody can sign in to. `Handle` is its user name.</summary>
public record DemoGuest(Guid Id, string Handle, string DisplayName);

/// <summary>What the base seed made, handed to every IDemoSeed. Venues are named by slug: "monkey", "kula", "dr-house", …</summary>
public class DemoContext
{
    private readonly Dictionary<string, Guid> _hosts;
    private readonly Dictionary<string, Guid> _running;
    private readonly Dictionary<string, IReadOnlyList<Guid>> _upcoming;
    private readonly Dictionary<string, DemoGuest> _byHandle;

    public DemoContext(DateTime now, IReadOnlyList<string> venueSlugs, Dictionary<string, Guid> hosts, Dictionary<string, Guid> running,
        Dictionary<string, IReadOnlyList<Guid>> upcoming, IReadOnlyList<DemoGuest> guests, Dictionary<string, DemoGuest> guestsByName, Guid? ownerId)
    {
        Now = now;
        VenueSlugs = venueSlugs;
        _hosts = hosts;
        _running = running;
        _upcoming = upcoming;
        Guests = guests;
        _byHandle = guestsByName;
        OwnerId = ownerId;
    }

    /// <summary>The moment this round of seeding started (UTC). Use it instead of asking the clock again.</summary>
    public DateTime Now { get; }

    /// <summary>The seven demo venues, in the order they are listed in DemoSeeder.</summary>
    public IReadOnlyList<string> VenueSlugs { get; }

    public Guid VenueId(string slug) => DemoSeeder.VenueIdFor(Known(slug));

    /// <summary>The account that runs the venue: a demo host, or the owner once they have taken the first venue over.</summary>
    public Guid HostId(string slug) => _hosts[Known(slug)];

    /// <summary>The venue's party that is on right now.</summary>
    public Guid RunningPartyId(string slug) => _running[Known(slug)];

    /// <summary>The venue's published parties that have not started, soonest first.</summary>
    public IReadOnlyList<Guid> UpcomingPartyIds(string slug) => _upcoming.GetValueOrDefault(Known(slug)) ?? [];

    /// <summary>All 24 demo guests, in account order (demo-guest-01 first).</summary>
    public IReadOnlyList<DemoGuest> Guests { get; }

    /// <summary>
    /// The user id of a demo guest by the name the seeder gave it: "mila", "luka", "ana", "dino", "sara", "jovana", …
    /// (That is also the guest's handle, unless a real account had the user name first.)
    /// </summary>
    public Guid Guest(string handle) =>
        _byHandle.TryGetValue(handle, out var guest) ? guest.Id : throw new ArgumentException($"No demo guest '{handle}'.", nameof(handle));

    /// <summary>The account named by Seed:OwnerEmail, when it exists.</summary>
    public Guid? OwnerId { get; }

    /// <summary>The same id for the same key, on every run and every machine.</summary>
    public Guid IdFor(string key) => Id(key);

    public static Guid Id(string key) => new(MD5.HashData(Encoding.UTF8.GetBytes("findmyparty-demo:" + key)));

    private string Known(string slug) =>
        _hosts.ContainsKey(slug) ? slug : throw new ArgumentException($"No demo venue '{slug}'.", nameof(slug));
}
