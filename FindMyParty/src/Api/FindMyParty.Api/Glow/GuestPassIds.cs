using FindMyParty.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Glow;

/// <summary>
/// A guest-pass holder's phone knows their pass by the guest pass id, not the booking id (lead's decision). Glow keys its
/// entries by booking; this translates between the two for one holder.
/// </summary>
public interface IGuestPassIds
{
    /// <summary>The booking behind a guest pass this user holds, or null.</summary>
    Task<Guid?> BookingIdAsync(Guid guestPassId, Guid holderId, CancellationToken ct);
    /// <summary>The guest pass this user holds on a booking, or null.</summary>
    Task<Guid?> GuestPassIdAsync(Guid bookingId, Guid holderId, CancellationToken ct);
}

/// <summary>
/// Reads A4's `GuestPasses` table (spec §2.2: Id, BookingId, ClaimedByUserId) through the EF model, so this package needs
/// no compile-time reference to it. While the model has no such entity (before the merge), there are no guest passes.
/// </summary>
public class ModelGuestPassIds(AppDbContext db) : IGuestPassIds
{
    private const string EntityName = "FindMyParty.Api.Bookings.GuestPass";

    public Task<Guid?> BookingIdAsync(Guid guestPassId, Guid holderId, CancellationToken ct) =>
        LookupAsync("BookingId", "Id", guestPassId, holderId, ct);

    public Task<Guid?> GuestPassIdAsync(Guid bookingId, Guid holderId, CancellationToken ct) =>
        LookupAsync("Id", "BookingId", bookingId, holderId, ct);

    private async Task<Guid?> LookupAsync(string wanted, string by, Guid value, Guid holderId, CancellationToken ct)
    {
        var entity = db.Model.FindEntityType(EntityName);
        if (entity?.GetTableName() is not { } table) return null;
        var store = Microsoft.EntityFrameworkCore.Metadata.StoreObjectIdentifier.Table(table, entity.GetSchema());
        string? Column(string property) => entity.FindProperty(property)?.GetColumnName(store);
        var holder = entity.FindProperty("ClaimedByUserId");
        if (Column(wanted) is not { } wantedColumn || Column(by) is not { } byColumn || holder?.GetColumnName(store) is not { } holderColumn)
            return null;

        // Names come from the model, not from input; values are parameters.
        object holderValue = holder.ClrType == typeof(string) ? holderId.ToString() : holderId;
        var sql = $"SELECT \"{wantedColumn}\" AS \"Value\" FROM \"{table}\" WHERE \"{byColumn}\" = " + "{0} AND \"" + holderColumn + "\" = {1} LIMIT 1";
        var found = await db.Database.SqlQueryRaw<Guid>(sql, value, holderValue).ToListAsync(ct);
        return found.Count == 0 ? null : found[0];
    }
}
