using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Bookings;

/// <summary>A person as a pass or the door shows them: "Vule M.", "Flame"; `First` is "Vule".</summary>
public record Person(string Name, string Short, string First, string LevelName)
{
    public static readonly Person Unknown = Of(null, null, 0);

    public static Person Of(string? displayName, string? userName, int glowLifetime)
    {
        var name = PersonName.Display(displayName, userName);
        return new Person(name, PersonName.Short(name), name.Split(' ', StringSplitOptions.RemoveEmptyEntries)[0], GlowLevels.For(glowLifetime).Name);
    }
}

public static class People
{
    public static async Task<Dictionary<Guid, Person>> ReadAsync(AppDbContext db, IEnumerable<Guid> userIds, CancellationToken ct)
    {
        var ids = userIds.Distinct().Select(id => id.ToString()).ToList();
        if (ids.Count == 0) return [];
        var rows = await db.Users.AsNoTracking().Where(u => ids.Contains(u.Id))
            .Select(u => new { u.Id, u.DisplayName, u.UserName, u.GlowLifetime }).ToListAsync(ct);
        return rows.ToDictionary(r => Guid.Parse(r.Id), r => Person.Of(r.DisplayName, r.UserName, r.GlowLifetime));
    }

    public static async Task<Person> ReadAsync(AppDbContext db, Guid userId, CancellationToken ct) =>
        (await ReadAsync(db, [userId], ct)).GetValueOrDefault(userId) ?? Person.Unknown;

    public static Person Get(this Dictionary<Guid, Person> people, Guid? userId) =>
        userId is { } id && people.TryGetValue(id, out var person) ? person : Person.Unknown;
}
