namespace FindMyParty.Api.Glow;

/// <summary>The kinds of Glow entry, as stored.</summary>
public static class GlowKinds
{
    public const string Scan = "scan";
    public const string BeforeMidnight = "beforeMidnight";
    public const string FirstAtVenue = "firstAtVenue";
    public const string Streak = "streak";
    public const string Multiplier = "multiplier";
    public const string Referral = "referral";
    public const string Claim = "claim";

    /// <summary>The parts of one scan's award, in the order they are shown.</summary>
    public static readonly string[] ScanParts = [Scan, BeforeMidnight, FirstAtVenue, Streak, Multiplier];

    public static string Label(string kind) => kind switch
    {
        Scan => "check-in",
        BeforeMidnight => "before midnight",
        FirstAtVenue => "first time here",
        Streak => "streak",
        Multiplier => "×1.5 streak bonus",
        Referral => "friend's first night",
        Claim => "claimed",
        _ => kind
    };
}

/// <summary>
/// One line in a guest's Glow ledger. A scan writes several (check-in, before midnight, …), a referral one for the
/// inviter, a claim one with negative points. The user row keeps the running totals.
/// </summary>
public class GlowEntry
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Kind { get; set; } = default!;
    public int Points { get; set; }
    public Guid? BookingId { get; set; }
    public Guid? VenueId { get; set; }
    public Guid? PartyId { get; set; }
    public Guid? ClaimId { get; set; }
    public DateTime At { get; set; }
    /// <summary>The night this belongs to, in the venue's city (a night ends at 06:00).</summary>
    public DateOnly NightDate { get; set; }
}

public static class PerkKinds
{
    public const string FreeEntryBefore = "freeEntryBefore";
    public const string PlusOneFree = "plusOneFree";
    public const string SkipLine = "skipLine";
    public const string Sponsored = "sponsored";

    /// <summary>The three a venue switches on, in the order hosts and guests see them.</summary>
    public static readonly string[] Level = [FreeEntryBefore, SkipLine, PlusOneFree];

    public static int MinLevel(string kind) => kind == FreeEntryBefore ? 3 : 4;

    public static bool IsLevel(string kind) => Level.Contains(kind);
}

/// <summary>A level perk a venue offers (or has switched off).</summary>
public class VenuePerk
{
    public Guid VenueId { get; set; }
    public string Kind { get; set; } = default!;
    public bool Enabled { get; set; }
    /// <summary>Free entry only: the local time it runs until (00:00 = midnight).</summary>
    public TimeOnly? UntilLocalTime { get; set; }
    public DateTime UpdatedAt { get; set; }
}

/// <summary>A perk a brand pays for, made by the platform admin. Guests spend Glow balance on it.</summary>
public class SponsoredPerk
{
    public Guid Id { get; set; }
    public string Title { get; set; } = default!;
    public string SponsorName { get; set; } = default!;
    public string LogoText { get; set; } = default!;
    public string ColorTop { get; set; } = default!;
    public string ColorBottom { get; set; } = default!;
    public string Ink { get; set; } = default!;
    public Guid VenueId { get; set; }
    public int MinLevel { get; set; }
    public int GlowCost { get; set; }
    /// <summary>Claims still to give; null for no limit. Goes down by one with each claim.</summary>
    public int? Stock { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
    public Guid CreatedByUserId { get; set; }
    public bool Active { get; set; }
}

public static class ClaimStatus
{
    public const string Claimed = "claimed";
    public const string Redeemed = "redeemed";
    public const string Expired = "expired";
}

/// <summary>A guest's claim on a sponsored perk: a code to show at the venue.</summary>
public class PerkClaim
{
    public Guid Id { get; set; }
    public Guid PerkId { get; set; }
    public Guid UserId { get; set; }
    public string Code { get; set; } = default!;
    public string Status { get; set; } = ClaimStatus.Claimed;
    public DateTime ClaimedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? RedeemedAt { get; set; }
    public Guid? RedeemedByUserId { get; set; }
}

/// <summary>A night recap the guest chose to share. The token is the public link.</summary>
public class RecapShare
{
    public string Token { get; set; } = default!;
    public Guid UserId { get; set; }
    public DateOnly NightDate { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>Marks that the "Your night" push went out for this night, so it goes out once.</summary>
public class RecapNotice
{
    public Guid UserId { get; set; }
    public DateOnly NightDate { get; set; }
    public DateTime SentAt { get; set; }
}
