using System.Globalization;
using System.Text.RegularExpressions;
using FindMyParty.Api.Common;

namespace FindMyParty.Api.Signs;

/// <summary>Weeks, prices and what a sign may say. Days are nights: 01:00 on Monday still belongs to Sunday.</summary>
public static partial class SignRules
{
    public const int MaxTextLength = 24;
    public const int WeeksAhead = 8;
    public const int HostLimit = 3;

    /// <summary>Today in the city, as signs count it: the night `utc` belongs to.</summary>
    public static DateOnly Today(DateTime utc, string city) => CityClock.NightDate(utc, city);

    public static DateOnly Monday(DateOnly day) => day.AddDays(-(((int)day.DayOfWeek + 6) % 7));

    /// <summary>"2026-W46".</summary>
    public static string WeekId(DateOnly monday)
    {
        var date = monday.ToDateTime(TimeOnly.MinValue);
        return $"{ISOWeek.GetYear(date):0000}-W{ISOWeek.GetWeekOfYear(date):00}";
    }

    public static bool TryParseWeek(string? id, out DateOnly monday)
    {
        monday = default;
        var match = WeekPattern().Match(id ?? "");
        if (!match.Success) return false;
        int year = int.Parse(match.Groups[1].Value, CultureInfo.InvariantCulture), week = int.Parse(match.Groups[2].Value, CultureInfo.InvariantCulture);
        if (year is < 2000 or > 2999 || week < 1 || week > ISOWeek.GetWeeksInYear(year)) return false;
        monday = DateOnly.FromDateTime(ISOWeek.ToDateTime(year, week, DayOfWeek.Monday));
        return true;
    }

    /// <summary>"This week", "Next week", then "17–23 Nov" (or "30 Nov–6 Dec").</summary>
    public static SignWeek Week(DateOnly monday, DateOnly thisMonday)
    {
        var sunday = monday.AddDays(6);
        var label = monday == thisMonday ? "This week"
            : monday == thisMonday.AddDays(7) ? "Next week"
            : monday.Month == sunday.Month
                ? $"{monday.Day}–{sunday.Day} {Month(sunday)}"
                : $"{monday.Day} {Month(monday)}–{sunday.Day} {Month(sunday)}";
        return new SignWeek(WeekId(monday), monday, sunday, label);
    }

    private static string Month(DateOnly d) => d.ToString("MMM", CultureInfo.InvariantCulture);

    /// <summary>This week and the next eight.</summary>
    public static List<SignWeek> Window(DateOnly today)
    {
        var thisMonday = Monday(today);
        return Enumerable.Range(0, WeeksAhead + 1).Select(i => Week(thisMonday.AddDays(7 * i), thisMonday)).ToList();
    }

    /// <summary>The text as stored (lines trimmed), or null when it breaks the rules: 1–24 characters, at most two lines.</summary>
    public static string? CleanText(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var lines = text.Split('|').Select(l => l.Trim()).ToArray();
        if (lines.Length > 2 || lines.Any(l => l.Length == 0)) return null;
        var length = lines.Sum(l => l.Length);
        return length is >= 1 and <= MaxTextLength ? string.Join('|', lines) : null;
    }

    /// <summary>"#ff7a18" (lower case), or null for anything that is not six hex digits.</summary>
    public static string? CleanColor(string? color) =>
        color is not null && ColorPattern().IsMatch(color) ? color.ToLowerInvariant() : null;

    public static string Title(string format) => format switch
    {
        SignSpot.Facade => "Facade panel",
        SignSpot.Hologram => "Rooftop hologram",
        _ => "Slot in Tonight",
    };

    /// <summary>What a card's tile shows: the first line, eight characters at most.</summary>
    public static string LogoText(string text)
    {
        var first = text.Split('|')[0];
        return first.Length <= 8 ? first : first[..8];
    }

    [GeneratedRegex(@"^(\d{4})-W(\d{2})$")]
    private static partial Regex WeekPattern();

    [GeneratedRegex("^#[0-9a-fA-F]{6}$")]
    private static partial Regex ColorPattern();
}

/// <summary>Signs:FacadeWeekly (40), Signs:HologramWeekly (90), Signs:TonightSlot (15), Signs:TonightSlotsPerNight (2).</summary>
public class SignSettings(IConfiguration config)
{
    public decimal FacadeWeekly => config.GetValue("Signs:FacadeWeekly", 40m);
    public decimal HologramWeekly => config.GetValue("Signs:HologramWeekly", 90m);
    public decimal TonightSlot => config.GetValue("Signs:TonightSlot", 15m);
    public int TonightSlotsPerNight => config.GetValue("Signs:TonightSlotsPerNight", 2);

    public decimal Weekly(string format) => format == SignSpot.Hologram ? HologramWeekly : FacadeWeekly;
    public decimal PriceOf(SignSpot spot) => spot.WeeklyPrice ?? Weekly(spot.Format);
}
