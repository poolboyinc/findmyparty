using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using FindMyParty.Api.Parties;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Cities;

/// <summary>Finding a city by slug or by place.</summary>
public static class CityLookup
{
    /// <summary>The slug as stored (lower case), or null when none was given. An unknown slug is 400 city_unknown.</summary>
    public static async Task<string?> RequireAsync(AppDbContext db, string? slug, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(slug)) return null;
        var wanted = slug.Trim().ToLowerInvariant();
        return await db.Set<City>().AnyAsync(c => c.Slug == wanted, ct)
            ? wanted
            : throw ApiException.Invalid("That city is not on FindMyParty yet.", "city_unknown");
    }

    /// <summary>The city whose centre is nearest to this point.</summary>
    public static async Task<string> NearestAsync(AppDbContext db, double latitude, double longitude, CancellationToken ct = default)
    {
        var cities = await db.Set<City>().AsNoTracking().Select(c => new { c.Slug, c.Latitude, c.Longitude }).ToListAsync(ct);
        return cities.MinBy(c => Geo.DistanceKm(latitude, longitude, c.Latitude, c.Longitude))?.Slug ?? City.Default;
    }
}
