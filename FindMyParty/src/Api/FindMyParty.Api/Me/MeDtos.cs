namespace FindMyParty.Api.Me;

public record MeLevel(string Name, int Number);
public record MePrivacy(bool ShareWithFriends, DateTime? InvisibleUntil, bool Suspended);
public record MeNotifications(bool Venues, bool Friends, bool Nights);

/// <summary>The signed-in account as S-18 and the settings screen show it.</summary>
public record MeResponse(
    Guid Id,
    string UserName,
    string Handle,
    string DisplayName,
    string Email,
    IReadOnlyList<string> Roles,
    DateTime CreatedAt,
    string? City,
    IReadOnlyList<string> Taste,
    IReadOnlyList<SoundShare> Sound,
    MeLevel Level,
    int GlowLifetime,
    MePrivacy Privacy,
    MeNotifications Notifications,
    bool HasPassword,
    Guid? VenueId);

public record NotificationSwitches(bool? Venues, bool? Friends, bool? Nights);

/// <summary>PATCH /api/me: only what is sent changes.</summary>
public record UpdateMeRequest(string? DisplayName, string? City, List<string?>? Taste, NotificationSwitches? Notifications);

public record SavedResponse(IReadOnlyList<Guid> Parties, IReadOnlyList<Guid> Venues);

/// <summary>The saved ids a phone kept on its own before saving moved to the account. Ids it cannot read are skipped.</summary>
public record ImportSavedRequest(List<string?>? Parties, List<string?>? Venues);
