using System.Collections.Concurrent;
using FindMyParty.Api.Cities;

namespace FindMyParty.Api.Common;

/// <summary>
/// Time as a city lives it. A night out belongs to the date it started on and ends at 06:00,
/// so 01:30 on Saturday is still Friday's night.
/// </summary>
public static class CityClock
{
    public const string DefaultTimeZone = "Europe/Podgorica";
    public const int NightEndsAtHour = 6;

    private static readonly ConcurrentDictionary<string, TimeZoneInfo> Zones = new();

    /// <summary>The city's time zone. An unknown or missing city gets Podgorica's.</summary>
    public static TimeZoneInfo Zone(string? citySlug)
    {
        var id = City.All.FirstOrDefault(c => c.Slug == citySlug)?.TimeZone ?? DefaultTimeZone;
        return Zones.GetOrAdd(id, TimeZoneInfo.FindSystemTimeZoneById);
    }

    /// <summary>The wall-clock time in the city at this UTC moment.</summary>
    public static DateTime Local(DateTime utc, string? citySlug) =>
        TimeZoneInfo.ConvertTimeFromUtc(utc.Kind == DateTimeKind.Local ? utc.ToUniversalTime() : utc, Zone(citySlug));

    /// <summary>The UTC moment of a wall-clock time in the city. A time skipped when clocks go forward moves an hour on.</summary>
    public static DateTime Utc(DateTime local, string? citySlug)
    {
        var zone = Zone(citySlug);
        var wall = DateTime.SpecifyKind(local, DateTimeKind.Unspecified);
        if (zone.IsInvalidTime(wall)) wall = wall.AddHours(1);
        return TimeZoneInfo.ConvertTimeToUtc(wall, zone);
    }

    /// <summary>The night this moment belongs to: the city's date six hours earlier.</summary>
    public static DateOnly NightDate(DateTime utc, string? citySlug) =>
        DateOnly.FromDateTime(Local(utc, citySlug).AddHours(-NightEndsAtHour));

    /// <summary>Friday, Saturday and Sunday nights make a weekend.</summary>
    public static bool IsWeekendNight(DateOnly date) =>
        date.DayOfWeek is DayOfWeek.Friday or DayOfWeek.Saturday or DayOfWeek.Sunday;
}
