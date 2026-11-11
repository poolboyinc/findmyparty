using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using FindMyParty.Api.Parties;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Me;

/// <summary>Saved parties and venues. Saving is idempotent both ways; a target that was removed drops out of the list.</summary>
public class SavedService(AppDbContext db, TimeProvider time)
{
    public const int MaxImport = 200;

    private IQueryable<SavedItem> Items => db.Set<SavedItem>();

    public async Task<SavedResponse> ListAsync(Guid userId, CancellationToken ct)
    {
        var rows = await Items
            .Where(s => s.UserId == userId)
            .Where(s => (s.Kind == SavedItem.Party && db.Parties.Any(p => p.Id == s.TargetId && !p.IsDeleted))
                        || (s.Kind == SavedItem.Venue && db.VenueProfiles.Any(v => v.Id == s.TargetId)))
            .OrderBy(s => s.CreatedAt).ThenBy(s => s.TargetId)
            .Select(s => new { s.Kind, s.TargetId })
            .ToListAsync(ct);
        return new SavedResponse(
            rows.Where(r => r.Kind == SavedItem.Party).Select(r => r.TargetId).ToList(),
            rows.Where(r => r.Kind == SavedItem.Venue).Select(r => r.TargetId).ToList());
    }

    public async Task SaveAsync(Guid userId, string kindText, Guid targetId, CancellationToken ct)
    {
        var kind = KindOrNotFound(kindText);
        if ((await ExistingAsync(kind, [targetId], ct)).Count == 0) throw NotFound(kind);
        await InsertAsync(userId, kind, [targetId], ct);
    }

    /// <summary>Unsaving what is not saved is fine; only a target that never existed (and is not saved) is not found.</summary>
    public async Task UnsaveAsync(Guid userId, string kindText, Guid targetId, CancellationToken ct)
    {
        var kind = KindOrNotFound(kindText);
        var removed = await Items.Where(s => s.UserId == userId && s.Kind == kind && s.TargetId == targetId).ExecuteDeleteAsync(ct);
        if (removed == 0 && (await ExistingAsync(kind, [targetId], ct)).Count == 0) throw NotFound(kind);
    }

    /// <summary>Adds the ids that name a real party or venue, in the order given; the rest are skipped.</summary>
    public async Task<SavedResponse> ImportAsync(Guid userId, ImportSavedRequest request, CancellationToken ct)
    {
        var parties = request.Parties ?? [];
        var venues = request.Venues ?? [];
        if (parties.Count > MaxImport || venues.Count > MaxImport)
            throw ApiException.Invalid($"At most {MaxImport} parties and {MaxImport} venues at once.");

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        foreach (var (kind, ids) in new[] { (SavedItem.Party, parties), (SavedItem.Venue, venues) })
        {
            var wanted = ids.Select(i => Guid.TryParse(i, out var id) ? id : Guid.Empty).Where(id => id != Guid.Empty).Distinct().ToList();
            var existing = await ExistingAsync(kind, wanted, ct);
            await InsertAsync(userId, kind, wanted.Where(existing.Contains).ToList(), ct);
        }
        await tx.CommitAsync(ct);

        return await ListAsync(userId, ct);
    }

    private async Task<HashSet<Guid>> ExistingAsync(string kind, IReadOnlyCollection<Guid> ids, CancellationToken ct)
    {
        if (ids.Count == 0) return [];
        var found = kind == SavedItem.Party
            ? await db.Parties.Where(p => ids.Contains(p.Id) && !p.IsDeleted && p.Status != PartyStatus.Draft).Select(p => p.Id).ToListAsync(ct)
            : await db.VenueProfiles.Where(v => ids.Contains(v.Id)).Select(v => v.Id).ToListAsync(ct);
        return found.ToHashSet();
    }

    /// <summary>One statement for any number of rows. A row that is already there stays as it was (also when two requests race).</summary>
    private async Task InsertAsync(Guid userId, string kind, IReadOnlyList<Guid> ids, CancellationToken ct)
    {
        if (ids.Count == 0) return;
        var now = time.GetUtcNow().UtcDateTime;
        var targets = ids.ToArray();
        // A microsecond apart, so the list keeps the order they were given in.
        var times = ids.Select((_, i) => now.AddTicks(i * 10)).ToArray();
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "SavedItems" ("UserId", "Kind", "TargetId", "CreatedAt")
            SELECT {userId}, {kind}, t.id, t.at FROM unnest({targets}, {times}) AS t(id, at)
            ON CONFLICT DO NOTHING
            """, ct);
    }

    private static string KindOrNotFound(string kindText) =>
        SavedItem.KindFrom(kindText) ?? throw ApiException.NotFound("That kind of item");

    private static ApiException NotFound(string kind) => ApiException.NotFound(kind == SavedItem.Party ? "Party" : "Venue");
}

/// <summary>A deleted account's saved items go, and so does its venue from everyone else's list.</summary>
public class SavedCleanup(AppDbContext db) : IAccountCleanup
{
    public async Task DeleteAsync(Guid userId, CancellationToken ct)
    {
        var id = userId.ToString();
        var venueIds = await db.VenueProfiles.Where(v => v.UserId == id).Select(v => v.Id).ToListAsync(ct);
        await db.Set<SavedItem>()
            .Where(s => s.UserId == userId || (s.Kind == SavedItem.Venue && venueIds.Contains(s.TargetId)))
            .ExecuteDeleteAsync(ct);
    }
}
