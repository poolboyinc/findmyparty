using FindMyParty.Api.Cities;
using FindMyParty.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Demo.Seeds;

/// <summary>
/// Demo guests live in Podgorica and have picked a sound, so their profiles look like real ones.
/// Only fills what is empty, so it is safe to run again and never undoes a change.
/// </summary>
public class MeDemoSeed(AppDbContext db) : IDemoSeed
{
    public int Order => 5;

    // Pick lists from the S-02 pads; guest n gets entry n (round the list).
    private static readonly string[][] Picks =
    [
        ["Techno", "House", "Live"],    // mila
        ["House", "Techno"],            // luka
        ["Techno", "Hip-Hop", "Pop"],   // ana
        ["Balkan", "Pop", "Hip-Hop"],   // dino
        ["House", "Latin", "R&B"],      // sara
        ["Pop", "R&B", "Latin", "Live"],// jovana
        ["Techno"],
        ["Hip-Hop", "R&B", "Pop"],
        ["Live", "Rock", "Balkan"],
        ["House", "Pop"],
        ["Techno", "Balkan", "House"],
        ["Latin", "Pop", "House"],
    ];

    public async Task SeedAsync(DemoContext demo, CancellationToken ct)
    {
        var ids = demo.Guests.Select(g => g.Id.ToString()).ToList();
        var users = await db.Users.Where(u => ids.Contains(u.Id) && (u.HomeCity == null || u.Taste == null)).ToListAsync(ct);
        foreach (var user in users)
        {
            var index = ids.IndexOf(user.Id);
            user.HomeCity ??= City.Default;
            user.Taste ??= string.Join(',', Picks[index % Picks.Length]);
        }
        await db.SaveChangesAsync(ct);
    }
}
