using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Parties;

/// <summary>A party's line-up: checking it, storing it, reading it back in time order.</summary>
public static class Lineup
{
    public const int MaxActs = 8;

    /// <summary>
    /// The acts as they will be stored, in time order, or acts_invalid: more than eight, a name missing or too long,
    /// or a set time outside the party's hours (from its start, before its end).
    /// </summary>
    public static List<PartyAct> Check(Party party, IReadOnlyList<PartyActInput> acts)
    {
        if (acts.Count > MaxActs) throw Invalid();
        var checkedActs = new List<PartyAct>(acts.Count);
        foreach (var act in acts)
        {
            var name = act.Name?.Trim();
            var role = string.IsNullOrWhiteSpace(act.Role) ? null : act.Role.Trim();
            if (string.IsNullOrEmpty(name) || name.Length > 100 || role?.Length > 100) throw Invalid();
            if (act.StartsAt is not { } at) throw Invalid();
            at = at.Kind == DateTimeKind.Local ? at.ToUniversalTime() : DateTime.SpecifyKind(at, DateTimeKind.Utc);
            // The database keeps microseconds: compare at that grain, so a stored act still fits after a round trip.
            if (Micro(at) < Micro(party.StartsAt) || Micro(at) >= Micro(party.EndsAt)) throw Invalid();
            checkedActs.Add(new PartyAct { Id = Guid.NewGuid(), PartyId = party.Id, Name = name, Role = role, StartsAt = at });
        }

        // Stable: two acts at the same time keep the order they were sent in.
        var ordered = checkedActs.OrderBy(a => a.StartsAt).ToList();
        for (var i = 0; i < ordered.Count; i++) ordered[i].Order = i;
        return ordered;
    }

    /// <summary>Replaces the party's acts (not saved yet) and makes the first one the performer.</summary>
    public static async Task ReplaceAsync(AppDbContext db, Party party, List<PartyAct> acts, CancellationToken ct = default)
    {
        await db.Set<PartyAct>().Where(a => a.PartyId == party.Id).ExecuteDeleteAsync(ct);
        db.Set<PartyAct>().AddRange(acts);
        var first = acts.FirstOrDefault();
        party.SetHeadliner(first?.Name, first?.Role);
    }

    /// <summary>The acts of these parties, each list in time order.</summary>
    public static async Task<Dictionary<Guid, List<PartyActDto>>> ForAsync(AppDbContext db, IReadOnlyCollection<Guid> partyIds, CancellationToken ct = default)
    {
        if (partyIds.Count == 0) return [];
        var rows = await db.Set<PartyAct>().AsNoTracking()
            .Where(a => partyIds.Contains(a.PartyId))
            .OrderBy(a => a.PartyId).ThenBy(a => a.Order)
            .Select(a => new { a.PartyId, a.Name, a.Role, a.StartsAt })
            .ToListAsync(ct);
        return rows.GroupBy(r => r.PartyId).ToDictionary(g => g.Key, g => g.Select(r => new PartyActDto(r.Name, r.Role, r.StartsAt)).ToList());
    }

    /// <summary>"Lena K, DJ Proximus". A party with no acts shows its performer, if it has one.</summary>
    public static string? Text(IReadOnlyList<PartyActDto>? acts, string? performerName) =>
        acts is { Count: > 0 } ? string.Join(", ", acts.Select(a => a.Name)) : string.IsNullOrWhiteSpace(performerName) ? null : performerName;

    private static long Micro(DateTime t) => t.Ticks / 10;

    private static ApiException Invalid() => ApiException.Invalid("Set times must be inside the party's hours.", "acts_invalid");
}
