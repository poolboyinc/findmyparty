using FindMyParty.Api.Bookings;
using FindMyParty.Api.Data;
using FindMyParty.Api.Friends;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Demo.Seeds;

/// <summary>
/// The six named demo guests share with friends. With an owner (and Seed:OwnerHistory on): Mila, Luka, Ana, Dino and
/// Sara are the owner's friends, Jovana's request waits, and the five are scanned in tonight: Mila, Ana and Sara at
/// Monkey, Luka at Dr. House, Dino at Blok 5. The owner's own switch is left off, as drawn; switching it on shows
/// "5 friends out. Mila and 2 more at Monkey". Without an owner nobody could see them, so nobody is placed.
/// A friendship the owner ended comes back on the next run unless they blocked that guest.
/// </summary>
public class FriendsDemoSeed(AppDbContext db, IConfiguration config) : IDemoSeed
{
    public int Order => 40;

    private static readonly string[] Named = ["mila", "luka", "ana", "dino", "sara", "jovana"];
    private static readonly string[] OwnersFriends = ["mila", "luka", "ana", "dino", "sara"];
    private static readonly (string Guest, string Venue)[] OutTonight =
        [("mila", "monkey"), ("ana", "monkey"), ("sara", "monkey"), ("luka", "dr-house"), ("dino", "blok-5")];

    public async Task SeedAsync(DemoContext demo, CancellationToken ct)
    {
        var named = Named.Select(h => demo.Guest(h).ToString()).ToList();
        await db.Users.Where(u => named.Contains(u.Id) && !u.ShareWithFriends)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.ShareWithFriends, true), ct);

        if (demo.OwnerId is not { } owner || !config.GetValue("Seed:OwnerHistory", true)) return;

        foreach (var handle in OwnersFriends) await EdgeAsync(demo, owner, handle, accepted: true, ct);
        await EdgeAsync(demo, owner, "jovana", accepted: false, ct);

        for (var i = 0; i < OutTonight.Length; i++) await ScanInAsync(demo, OutTonight[i].Guest, OutTonight[i].Venue, i, ct);
    }

    /// <summary>A friendship (or the guest's request to the owner), unless the two already have one or a block.</summary>
    private async Task EdgeAsync(DemoContext demo, Guid owner, string handle, bool accepted, CancellationToken ct)
    {
        var guest = demo.Guest(handle);
        var (low, high) = Friendship.Pair(owner, guest);
        if (await db.Set<Friendship>().AnyAsync(f => f.UserLowId == low && f.UserHighId == high, ct)) return;
        if (await db.Set<UserBlock>().AnyAsync(b => (b.BlockerId == owner && b.BlockedId == guest) || (b.BlockerId == guest && b.BlockedId == owner), ct)) return;

        var id = demo.IdFor($"friends:{owner:N}:{handle}");
        if (await db.Set<Friendship>().AnyAsync(f => f.Id == id, ct)) return;
        db.Set<Friendship>().Add(new Friendship
        {
            Id = id, UserLowId = low, UserHighId = high, RequestedById = guest,
            Status = accepted ? Friendship.Accepted : Friendship.Pending,
            CreatedAt = demo.Now.AddDays(-20), AcceptedAt = accepted ? demo.Now.AddDays(-19) : null,
        });
        await db.SaveChangesAsync(ct);
    }

    /// <summary>A one-guest pass at the venue's running party, scanned in a while ago, unless that guest already has it.</summary>
    private async Task ScanInAsync(DemoContext demo, string handle, string venue, int index, CancellationToken ct)
    {
        Guid partyId;
        try { partyId = demo.RunningPartyId(venue); }
        catch (KeyNotFoundException) { return; } // nothing on there right now

        var guest = demo.Guest(handle);
        var key = $"demo-friends-{partyId:N}-{handle}";
        if (await db.Bookings.AnyAsync(b => b.UserId == guest && b.IdempotencyKey == key, ct)) return;
        var party = await db.Parties.AsNoTracking().Where(p => p.Id == partyId)
            .Select(p => new { p.HostId, p.Price, p.StartsAt, p.EndsAt }).FirstAsync(ct);

        var at = demo.Now.AddMinutes(-50 + index * 8);
        if (at < party.StartsAt) at = party.StartsAt;
        var booking = new Booking(guest, partyId, 1, party.Price, key, party.EndsAt);
        db.Bookings.Add(booking);
        db.Entry(booking).Property(b => b.Id).CurrentValue = demo.IdFor("friends:booking:" + key);
        db.Entry(booking).Property(b => b.CheckedInCount).CurrentValue = 1;
        db.Entry(booking).Property(b => b.FirstCheckedInAt).CurrentValue = at;
        db.Entry(booking).Property(b => b.Status).CurrentValue = BookingStatus.Confirmed;
        db.CheckIns.Add(new CheckIn
        {
            Id = demo.IdFor("friends:scan:" + key), BookingId = booking.Id, PartyId = partyId, Admitted = 1, At = at,
            ByUserId = party.HostId, GuestUserId = guest,
        });
        await db.SaveChangesAsync(ct);
        await db.Parties.Where(p => p.Id == partyId).ExecuteUpdateAsync(s => s.SetProperty(p => p.TicketsSold, p => p.TicketsSold + 1), ct);
    }
}
