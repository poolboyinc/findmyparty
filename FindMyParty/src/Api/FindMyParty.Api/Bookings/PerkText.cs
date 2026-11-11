using FindMyParty.Api.Common;

namespace FindMyParty.Api.Bookings;

/// <summary>
/// How a booking's perk is worded at checkout and at the door. Built from the perk's key, not from the stored title
/// (the pricer stores the party page's wording, "Free for you before midnight"). Unknown keys fall back to the stored title.
/// </summary>
public static class PerkText
{
    public const string FreeEntryBefore = "freeEntryBefore";
    public const string PlusOneFree = "plusOneFree";

    /// <summary>"Free before midnight", "Free before 01:00", "Free +1".</summary>
    public static string Name(Booking b) => b.PerkKey switch
    {
        FreeEntryBefore => b.PerkValidUntil is { } until && CityClock.Local(until, null) is var local && local.TimeOfDay != TimeSpan.Zero
            ? $"Free before {local:HH:mm}"
            : "Free before midnight",
        PlusOneFree => "Free +1",
        _ => b.PerkTitle ?? "Perk"
    };

    /// <summary>At checkout: "Free before midnight (you)", "Free +1".</summary>
    public static string? Checkout(Booking b) => b.PerkKey switch
    {
        FreeEntryBefore => $"{Name(b)} (you)",
        PlusOneFree => Name(b),
        _ => b.PerkTitle
    };
}
