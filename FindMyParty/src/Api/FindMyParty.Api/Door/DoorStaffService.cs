using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using FindMyParty.Api.Bookings;
using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using FindMyParty.Api.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Door;

/// <summary>A host's door logins: made with a generated password shown once, reset, removed.</summary>
public class DoorStaffService(AppDbContext db, UserManager<ApplicationUser> users, TimeProvider time)
{
    public const int MaxPerVenue = 10;
    public const string EmailDomain = "door.findmyparty.invalid";

    private DateTime Now => time.GetUtcNow().UtcDateTime;

    private async Task<(Guid Id, string Name)> VenueOfAsync(Guid hostId, CancellationToken ct)
    {
        var id = hostId.ToString();
        var venue = await db.VenueProfiles.AsNoTracking().Where(v => v.UserId == id).Select(v => new { v.Id, v.VenueName }).FirstOrDefaultAsync(ct)
                    ?? throw ApiException.NotFound("Venue");
        return (venue.Id, venue.VenueName);
    }

    public async Task<List<DoorStaffResponse>> ListAsync(Guid hostId, CancellationToken ct = default)
    {
        var (venueId, _) = await VenueOfAsync(hostId, ct);
        var rows = await (
            from s in db.Set<DoorStaff>()
            where s.VenueId == venueId && s.RevokedAt == null
            join u in db.Users on s.UserId equals u.Id
            orderby s.CreatedAt
            select new { s, u.UserName }).AsNoTracking().ToListAsync(ct);
        var userIds = rows.Select(r => Guid.Parse(r.s.UserId)).ToList();
        var lastScans = await db.CheckIns.Where(c => userIds.Contains(c.ByUserId))
            .GroupBy(c => c.ByUserId).Select(g => new { g.Key, Last = g.Max(c => c.At) })
            .ToDictionaryAsync(g => g.Key, g => (DateTime?)g.Last, ct);
        return rows.Select(r => new DoorStaffResponse(r.s.Id, r.s.Name, r.s.DoorName, r.UserName ?? "", r.s.CreatedAt,
            lastScans.GetValueOrDefault(Guid.Parse(r.s.UserId)))).ToList();
    }

    private static string Valid(string? value) =>
        value?.Trim() is { Length: >= 1 and <= 40 } v ? v : throw ApiException.Invalid("A name is 1 to 40 characters.", "name_invalid");

    /// <summary>Makes a door login `{venue}-door{n}` with role Door only. The password is in the answer and nowhere else.</summary>
    public async Task<DoorStaffCreated> CreateAsync(Guid hostId, string? name, string? doorName, CancellationToken ct = default) =>
        await CreateForVenueAsync(await VenueOfAsync(hostId, ct), Valid(name), Valid(doorName), GeneratePassword(), ct);

    /// <summary>Also used by the demo seed. `password` null makes a login nobody can sign in to yet.</summary>
    public async Task<DoorStaffCreated> CreateForVenueAsync((Guid Id, string Name) venue, string name, string doorName, string? password,
        CancellationToken ct = default, string? userName = null)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        // One request at a time per venue, so two at once cannot both take the tenth place.
        await db.Database.ExecuteSqlAsync($"SELECT 1 FROM \"VenueProfiles\" WHERE \"Id\" = {venue.Id} FOR UPDATE", ct);
        if (await db.Set<DoorStaff>().CountAsync(s => s.VenueId == venue.Id && s.RevokedAt == null, ct) >= MaxPerVenue)
            throw ApiException.Conflict("A venue can have ten door logins.", "door_staff_limit");

        userName ??= await FreeUserNameAsync(Slug(venue.Name), ct);
        var user = new ApplicationUser { UserName = userName, Email = $"{userName}@{EmailDomain}", EmailConfirmed = true, DisplayName = name };
        var created = password is null ? await users.CreateAsync(user) : await users.CreateAsync(user, password);
        if (!created.Succeeded) throw new InvalidOperationException("Door login: " + string.Join("; ", created.Errors.Select(e => e.Description)));
        await users.AddToRoleAsync(user, Roles.Door);

        var staff = new DoorStaff { Id = Guid.NewGuid(), VenueId = venue.Id, UserId = user.Id, Name = name, DoorName = doorName, CreatedAt = Now };
        db.Set<DoorStaff>().Add(staff);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return new DoorStaffCreated(staff.Id, staff.Name, staff.DoorName, userName, staff.CreatedAt, null, password ?? "");
    }

    private async Task<string> FreeUserNameAsync(string slug, CancellationToken ct)
    {
        for (var n = 1; ; n++)
        {
            var candidate = $"{slug}-door{n}";
            if (await users.FindByNameAsync(candidate) is null) return candidate;
        }
    }

    private async Task<(DoorStaff Staff, ApplicationUser User)> FindAsync(Guid hostId, Guid staffId, CancellationToken ct)
    {
        var (venueId, _) = await VenueOfAsync(hostId, ct);
        var staff = await db.Set<DoorStaff>().FirstOrDefaultAsync(s => s.Id == staffId && s.VenueId == venueId, ct)
                    ?? throw ApiException.NotFound("Door login");
        var user = await users.FindByIdAsync(staff.UserId) ?? throw ApiException.NotFound("Door login");
        return (staff, user);
    }

    /// <summary>A new password, shown once. The old one stops working and every phone signed in with it is signed out.</summary>
    public async Task<DoorPasswordResponse> ResetPasswordAsync(Guid hostId, Guid staffId, CancellationToken ct = default)
    {
        var (staff, user) = await FindAsync(hostId, staffId, ct);
        if (staff.RevokedAt is not null) throw ApiException.NotFound("Door login");
        var password = GeneratePassword();
        if (await users.HasPasswordAsync(user)) await users.RemovePasswordAsync(user);
        var set = await users.AddPasswordAsync(user, password);
        if (!set.Succeeded) throw new InvalidOperationException("Door password: " + string.Join("; ", set.Errors.Select(e => e.Description)));
        await SignOutEverywhereAsync(user.Id, ct);
        return new DoorPasswordResponse(password);
    }

    /// <summary>Removes a door login: it can no longer sign in, renew its session or scan. Removing twice is harmless.</summary>
    public async Task RemoveAsync(Guid hostId, Guid staffId, CancellationToken ct = default)
    {
        var (staff, user) = await FindAsync(hostId, staffId, ct);
        if (staff.RevokedAt is not null) return;
        staff.RevokedAt = Now;
        await db.SaveChangesAsync(ct);
        if (await users.HasPasswordAsync(user)) await users.RemovePasswordAsync(user);
        await users.UpdateSecurityStampAsync(user);
        await SignOutEverywhereAsync(user.Id, ct);
    }

    private Task SignOutEverywhereAsync(string userId, CancellationToken ct)
    {
        var now = Now;
        return db.RefreshTokens.Where(t => t.UserId == userId && t.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), ct);
    }

    /// <summary>"Dr. House" becomes "dr-house", "Neon Bašta" "neon-basta".</summary>
    public static string Slug(string venueName)
    {
        var plain = new StringBuilder();
        foreach (var c in venueName.Replace('đ', 'd').Replace('Đ', 'D').Normalize(NormalizationForm.FormD))
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark) plain.Append(c);
        var slug = new StringBuilder();
        foreach (var c in plain.ToString().ToLowerInvariant())
        {
            if (c is >= 'a' and <= 'z' or >= '0' and <= '9') slug.Append(c);
            else if (slug.Length > 0 && slug[^1] != '-') slug.Append('-');
        }
        var result = slug.ToString().Trim('-');
        if (result.Length > 30) result = result[..30].Trim('-');
        return result.Length == 0 ? "venue" : result;
    }

    /// <summary>Ten letters and digits, easy to read out at a door (no 0/O, 1/l/I), always with a digit and a lower-case letter.</summary>
    public static string GeneratePassword()
    {
        const string alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        while (true)
        {
            var chars = Enumerable.Range(0, 10).Select(_ => alphabet[RandomNumberGenerator.GetInt32(alphabet.Length)]).ToArray();
            if (chars.Any(char.IsDigit) && chars.Any(char.IsLower)) return new string(chars);
        }
    }
}
