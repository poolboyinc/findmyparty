using System.Globalization;
using FindMyParty.Api.Common;

namespace FindMyParty.Api.Glow;

/// <summary>The sentences the server writes about perks (spec §2.3 "Sentences the server writes").</summary>
public static class PerkText
{
    public static readonly TimeOnly Midnight = new(0, 0);

    /// <summary>"midnight", or "01:00" for another until-time.</summary>
    public static string Until(TimeOnly? until) =>
        (until ?? Midnight) == Midnight ? "midnight" : (until ?? Midnight).ToString("HH:mm", CultureInfo.InvariantCulture);

    /// <summary>PerkItem / VenuePerk / HostPerk title of a level perk.</summary>
    public static string Title(string kind, TimeOnly? until = null) => kind switch
    {
        PerkKinds.FreeEntryBefore => $"Free entry before {Until(until)}",
        PerkKinds.PlusOneFree => "Bring a +1 free",
        PerkKinds.SkipLine => "Skip the line",
        _ => kind
    };

    /// <summary>On the party page: "Free for you before midnight" / "Your +1 is free".</summary>
    public static string PartyTitle(string kind, TimeOnly? until) => kind == PerkKinds.FreeEntryBefore
        ? $"Free for you before {Until(until)}"
        : "Your +1 is free";

    /// <summary>
    /// On the checkout: the same words as on the party page (lead's decision, so the row does not change when the quote
    /// arrives; the spec had "Free before midnight (you)" / "Free +1").
    /// </summary>
    public static string QuoteTitle(string kind, TimeOnly? until) => PartyTitle(kind, until);

    public static string LevelName(int number) => GlowLevels.ByNumber(number).Name;

    /// <summary>"Monkey, Kula, Blok 5, Flame level".</summary>
    public static string Held(IEnumerable<string> venueNames, int minLevel) =>
        string.Join(", ", venueNames.Append($"{LevelName(minLevel)} level"));

    public static string Locked(int minLevel) => $"Unlocks at {LevelName(minLevel)}";

    /// <summary>"Tonight at Monkey, 400 Glow", or "Fri at Monkey, 400 Glow" for another night.</summary>
    public static string Sponsored(bool tonight, DateOnly night, string venueName, int cost) =>
        $"{(tonight ? "Tonight" : night.ToString("ddd", CultureInfo.InvariantCulture))} at {venueName}, {GlowRules.Points(cost)} Glow";

    /// <summary>VenuePerk.subtitle of a level perk the viewer holds: "Flame level, you have it".</summary>
    public static string YouHaveIt(int minLevel) => $"{LevelName(minLevel)} level, you have it";

    public const string ClaimedShowCode = "Claimed, show the code";
}
