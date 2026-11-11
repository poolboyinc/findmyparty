namespace FindMyParty.Api.Friends;

/// <summary>"none", "friend", "requested" (I asked), "incoming" (they asked), "blocked" (I blocked them).</summary>
public static class Relation
{
    public const string None = "none";
    public const string Friend = "friend";
    public const string Requested = "requested";
    public const string Incoming = "incoming";
    public const string Blocked = "blocked";
}

public record UserCard(Guid UserId, string Handle, string DisplayName, string Initial, string LevelName, string Relation, Guid? RequestId);

public record FriendDto(Guid UserId, string Handle, string DisplayName, string Initial, string LevelName, DateTime Since, bool Sharing);

public record FriendRequestDto(Guid Id, UserCard User, DateTime CreatedAt);

public record FriendsList(
    List<FriendDto> Friends, List<FriendRequestDto> Incoming, List<FriendRequestDto> Outgoing,
    bool Sharing, DateTime? InvisibleUntil, bool Suspended, string InviteUrl);

public record FriendAtVenue(Guid UserId, string DisplayName, string Initial);

public record FriendsAtVenue(Guid VenueId, string VenueName, double Latitude, double Longitude, int Count, List<FriendAtVenue> Friends);

public record FriendsHeadline(string Name, int Others, string VenueName);

/// <summary>The `FriendsOut` shape of the spec (a C# member cannot share its type's name, hence the suffix).</summary>
public record FriendsOutResponse(bool Sharing, int FriendsOut, FriendsHeadline? Headline, List<FriendsAtVenue> Venues);

/// <summary>Who of the viewer's friends is here: names ≤ 2 (first names), initials ≤ 3.</summary>
public record FriendsHere(int Count, List<string> Names, List<string> Initials);

public record ReportPerson(Guid UserId, string Handle);
public record ReportedPerson(Guid UserId, string Handle, string DisplayName, int OpenReports);
public record AdminReport(Guid Id, string Reason, string? Note, DateTime CreatedAt, string Status, ReportPerson Reporter, ReportedPerson Reported);

public record FriendRequestInput(Guid UserId);
public record PrivacyInput(bool? ShareWithFriends, bool? InvisibleTonight);
public record PrivacyState(bool ShareWithFriends, DateTime? InvisibleUntil);
public record ReportInput(string? Reason, string? Note);
public record ResolveInput(string? Action);
