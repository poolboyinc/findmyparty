using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using FindMyParty.Api.Door;
using FindMyParty.Api.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Demo.Seeds;

/// <summary>
/// Monkey's two door logins (monkey-door1 "Door 1", monkey-door2 "Door 2"; password from Seed:DoorPassword, none when empty),
/// Monkey's demo scans split between the two doors, and what was collected on every demo scan.
/// </summary>
public class DoorDemoSeed(AppDbContext db, UserManager<ApplicationUser> users, DoorStaffService staff, IConfiguration config, ILogger<DoorDemoSeed> logger) : IDemoSeed
{
    public int Order => 20;

    private static readonly (string UserName, string Name, string DoorName)[] Doors =
    [
        ("monkey-door1", "Door 1", "Door 1"),
        ("monkey-door2", "Door 2", "Door 2"),
    ];

    public async Task SeedAsync(DemoContext demo, CancellationToken ct)
    {
        var monkey = demo.VenueId("monkey");
        var password = config["Seed:DoorPassword"];
        var doorUsers = new List<Guid>();
        foreach (var (userName, name, doorName) in Doors)
        {
            var user = await users.FindByNameAsync(userName);
            if (user is null)
            {
                var venueName = await db.VenueProfiles.Where(v => v.Id == monkey).Select(v => v.VenueName).FirstAsync(ct);
                await staff.CreateForVenueAsync((monkey, venueName), name, doorName, null, ct, userName);
                user = (await users.FindByNameAsync(userName))!;
            }
            if (!string.IsNullOrEmpty(password) && !await users.HasPasswordAsync(user))
            {
                var set = await users.AddPasswordAsync(user, password);
                if (!set.Succeeded) logger.LogWarning("Seed:DoorPassword was not accepted for {UserName}: {Errors}", userName, string.Join("; ", set.Errors.Select(e => e.Description)));
            }
            doorUsers.Add(Guid.Parse(user.Id));
        }

        // Monkey's scans that no door has claimed yet go to Door 1 and Door 2 in turn.
        var monkeyParties = db.Parties.Where(p => p.VenueId == monkey).Select(p => p.Id);
        var unclaimed = await db.CheckIns.Where(c => monkeyParties.Contains(c.PartyId) && c.DoorName == HostOnlyVenueAccess.HostDoorName)
            .OrderBy(c => c.At).Select(c => c.Id).ToListAsync(ct);
        for (var door = 0; door < Doors.Length; door++)
        {
            var ids = unclaimed.Where((_, i) => i % Doors.Length == door).ToList();
            var (doorName, byUserId) = (Doors[door].DoorName, doorUsers[door]);
            await db.CheckIns.Where(c => ids.Contains(c.Id))
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.DoorName, doorName).SetProperty(c => c.ByUserId, byUserId), ct);
        }

        // What each demo scan collected: entry for everyone let in (demo bookings carry no perk).
        var venueIds = demo.VenueSlugs.Select(demo.VenueId).ToList();
        var parties = await db.Parties.Where(p => p.VenueId != null && venueIds.Contains(p.VenueId.Value) && p.Price > 0)
            .Select(p => new { p.Id, p.Price }).ToListAsync(ct);
        foreach (var party in parties)
        {
            var price = party.Price;
            await db.CheckIns.Where(c => c.PartyId == party.Id && c.AmountDue == 0)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.AmountDue, c => c.Admitted * price), ct);
        }
    }
}
