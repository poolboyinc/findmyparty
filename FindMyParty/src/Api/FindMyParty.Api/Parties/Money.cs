using System.Globalization;

namespace FindMyParty.Api.Parties;

/// <summary>Money and party times as the server writes them in sentences: "€5", "€7.50", "Fri 13 Nov, 23:00".</summary>
public static class Money
{
    /// <summary>"€5", "€7.50"; zero is "Free".</summary>
    public static string Text(decimal euros) =>
        euros <= 0 ? "Free"
        : euros == decimal.Truncate(euros) ? "€" + euros.ToString("0", CultureInfo.InvariantCulture)
        : "€" + euros.ToString("0.00", CultureInfo.InvariantCulture);

    /// <summary>"Fri 13 Nov, 23:00" in the city's own time.</summary>
    public static string When(DateTime utc, string? citySlug) =>
        Common.CityClock.Local(utc, citySlug).ToString("ddd d MMM, HH:mm", CultureInfo.InvariantCulture);
}
