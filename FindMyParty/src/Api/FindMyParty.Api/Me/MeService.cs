using FindMyParty.Api.Cities;
using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using FindMyParty.Api.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Me;

/// <summary>The account as its owner sees it, and the few things they change on it themselves.</summary>
public class MeService(AppDbContext db, UserManager<ApplicationUser> users, TimeProvider time)
{
    public const int MaxNameLength = 40;

    public async Task<MeResponse> GetAsync(Guid userId, CancellationToken ct)
    {
        var user = await FindAsync(userId, ct);
        return await ToResponseAsync(user, ct);
    }

    /// <summary>Checks everything first, so a refused change changes nothing.</summary>
    public async Task<MeResponse> UpdateAsync(Guid userId, UpdateMeRequest request, CancellationToken ct)
    {
        var user = await FindAsync(userId, ct);

        string? name = null;
        if (request.DisplayName is not null)
        {
            name = request.DisplayName.Trim();
            if (name.Length is 0 or > MaxNameLength) throw ApiException.Invalid("A name is 1 to 40 characters.", "name_invalid");
        }

        string? city = null;
        if (request.City is not null)
        {
            city = request.City.Trim().ToLowerInvariant();
            if (!await db.Set<City>().AnyAsync(c => c.Slug == city, ct))
                throw ApiException.Invalid("That city is not on FindMyParty yet.", "city_unknown");
        }

        List<string>? taste = null;
        if (request.Taste is not null)
            taste = Taste.Normalise(request.Taste) ?? throw ApiException.Invalid("Pick from the list.", "taste_invalid");

        if (name is not null) user.DisplayName = name;
        if (city is not null) user.HomeCity = city;
        if (taste is not null) user.Taste = taste.Count == 0 ? null : string.Join(',', taste);
        if (request.Notifications is { } n)
        {
            if (n.Venues is { } venues) user.NotifyVenues = venues;
            if (n.Friends is { } friends) user.NotifyFriends = friends;
            if (n.Nights is { } nights) user.NotifyNights = nights;
        }
        await db.SaveChangesAsync(ct);

        return await ToResponseAsync(user, ct);
    }

    private async Task<ApplicationUser> FindAsync(Guid userId, CancellationToken ct)
    {
        var id = userId.ToString();
        return await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct)
               ?? throw new ApiException(StatusCodes.Status401Unauthorized, "Sign in first.", "unauthenticated");
    }

    private async Task<MeResponse> ToResponseAsync(ApplicationUser user, CancellationToken ct)
    {
        var userId = Guid.Parse(user.Id);
        var roles = await users.GetRolesAsync(user);
        var venueId = await db.VenueProfiles.Where(v => v.UserId == user.Id).Select(v => (Guid?)v.Id).FirstOrDefaultAsync(ct);
        var picks = Taste.Parse(user.Taste);
        var level = GlowLevels.For(user.GlowLifetime);
        var now = time.GetUtcNow().UtcDateTime;
        var userName = user.UserName ?? "";

        return new MeResponse(
            userId,
            userName,
            userName.ToLowerInvariant(),
            PersonName.Display(user),
            user.Email ?? "",
            roles.Order(StringComparer.Ordinal).ToList(),
            DateTime.SpecifyKind(user.CreatedAt, DateTimeKind.Utc),
            user.HomeCity,
            picks,
            Taste.Sound(await ScannedGenresAsync(userId, ct), picks),
            new MeLevel(level.Name, level.Number),
            user.GlowLifetime,
            new MePrivacy(user.ShareWithFriends, user.InvisibleUntil > now ? user.InvisibleUntil : null, user.SharingSuspended),
            new MeNotifications(user.NotifyVenues, user.NotifyFriends, user.NotifyNights),
            user.PasswordHash is not null,
            venueId);
    }

    /// <summary>How many of the parties this user was scanned into had each genre. A party counts once however often they came in.</summary>
    private async Task<Dictionary<string, int>> ScannedGenresAsync(Guid userId, CancellationToken ct)
    {
        var rows = await db.CheckIns.Where(c => c.GuestUserId == userId).Select(c => c.PartyId).Distinct()
            .Join(db.Parties, id => id, p => p.Id, (_, p) => p.Genre)
            .Where(g => g != null && g != "")
            .GroupBy(g => g)
            .Select(g => new { Genre = g.Key!, Count = g.Count() })
            .ToListAsync(ct);

        // Hosts type genres freely; "techno" and "Techno" are one sound, written the way the pads write it.
        return rows
            .GroupBy(r => Taste.Genres.FirstOrDefault(t => string.Equals(t, r.Genre.Trim(), StringComparison.OrdinalIgnoreCase)) ?? r.Genre.Trim())
            .ToDictionary(g => g.Key, g => g.Sum(r => r.Count));
    }
}
