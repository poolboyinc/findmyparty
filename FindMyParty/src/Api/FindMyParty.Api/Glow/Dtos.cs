namespace FindMyParty.Api.Glow;

// The shapes of spec §2.5 ("glow", and the perk fields on venues, parties and quotes). camelCase on the wire.

public record GlowPart(string Kind, int Points, string Label);

public record GlowAward(Guid BookingId, DateTime At, Guid? VenueId, string? VenueName, int Points, IReadOnlyList<GlowPart> Parts, int StreakWeeks);

public record GlowBadge(string Id, string Label, string Hint, bool Earned, int Have, int Need);

public record GlowNight(Guid BookingId, DateOnly Date, DateTime At, string Title, string? VenueName, int Points);

public record LevelRef(string Name, int Number, int Min);
public record NextLevelRef(string Name, int Min);
public record LevelStep(string Name, int Min);

public record GlowSummary(
    int Lifetime,
    int Balance,
    LevelRef Level,
    NextLevelRef? Next,
    int? ToNext,
    double Ring,
    double Ladder,
    IReadOnlyList<LevelStep> Levels,
    int StreakWeeks,
    int MultiplierFromWeek,
    int NightsOut,
    int VenuesLit,
    IReadOnlyList<Guid> VenuesLitIds,
    IReadOnlyList<GlowBadge> Badges,
    IReadOnlyList<GlowNight> LastNights);

public record PerkClaimDto(
    Guid Id, Guid PerkId, string Title, string VenueName, string QrText, string Status,
    DateTime ClaimedAt, DateTime ExpiresAt, DateTime? RedeemedAt);

public record PerkItem(
    string Id,
    string Kind,
    string Title,
    string Subtitle,
    string State,
    bool Sponsored,
    string? SponsorName,
    string? LogoText,
    string? ColorTop,
    string? ColorBottom,
    string? Ink,
    int GlowCost,
    int MinLevel,
    string MinLevelName,
    IReadOnlyList<Guid> VenueIds,
    IReadOnlyList<string> VenueNames,
    DateTime? EndsAt,
    PerkClaimDto? Claim);

public static class PerkStates
{
    public const string Held = "held";
    public const string Claimable = "claimable";
    public const string Claimed = "claimed";
    public const string Short = "short";
    public const string Locked = "locked";
}

public record HostPerk(string Kind, string Title, string MinLevelName, bool Enabled, string? UntilLocalTime);

public record SetHostPerkRequest(bool Enabled, string? UntilLocalTime);

public record SponsoredPerkInput(
    string? Title, string? SponsorName, string? LogoText, string? ColorTop, string? ColorBottom, string? Ink,
    Guid VenueId, int MinLevel, int GlowCost, int? Stock, DateTime StartsAt, DateTime EndsAt);

public record RedeemRequest(string? Code);

public record RedeemResult(Guid ClaimId, string Title, string GuestName, DateTime RedeemedAt);

public record NightSummary(DateOnly Date, string CityName, int VenueCount, int Glow);

public record RecapVenue(Guid Id, string Name, double Latitude, double Longitude);

public record NightRecap(
    DateOnly Date, string CityName, string Headline, int MinutesOut, IReadOnlyList<RecapVenue> Venues,
    int Glow, string? MostlyGenre, string Handle, string LevelName, string? ShareUrl);

public record ShareUrlResponse(string ShareUrl);

public record SetReferrerRequest(string? Handle);

/// <summary>On a venue page: a perk the viewer holds there.</summary>
/// `perkId` is the sponsored perk's id (the phone opens /perk/{id}); null for a level perk.
public record VenuePerkDto(string PerkKey, string Kind, string Title, string Subtitle, bool Sponsored, string? PerkId);

/// <summary>On a party page: the perk the viewer would get on a booking right now.</summary>
public record PartyPerk(string PerkKey, string Kind, string Title);

/// <summary>The `data` of the `scanned` push.</summary>
public record ScannedPushData(Guid BookingId, GlowAward Award);

/// <summary>The `data` of the `recap_ready` push.</summary>
public record RecapPushData(DateOnly Date);
