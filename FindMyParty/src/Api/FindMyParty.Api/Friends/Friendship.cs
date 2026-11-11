namespace FindMyParty.Api.Friends;

/// <summary>
/// One edge between two people, stored once: the two ids in order (low, high), so a pair can only have one row.
/// "pending" while the other side has not answered, "accepted" once they did. Declining, withdrawing and
/// unfriending all delete the row.
/// </summary>
public class Friendship
{
    public const string Pending = "pending";
    public const string Accepted = "accepted";

    public Guid Id { get; set; }
    public Guid UserLowId { get; set; }
    public Guid UserHighId { get; set; }
    /// <summary>Who asked. The other one is the one who may accept.</summary>
    public Guid RequestedById { get; set; }
    public string Status { get; set; } = Pending;
    public DateTime CreatedAt { get; set; }
    public DateTime? AcceptedAt { get; set; }

    /// <summary>The two ids in the order they are stored: by the text of the id, so it never depends on how a runtime compares Guids.</summary>
    public static (Guid Low, Guid High) Pair(Guid a, Guid b) =>
        string.CompareOrdinal(a.ToString("N"), b.ToString("N")) < 0 ? (a, b) : (b, a);

    public Guid Other(Guid me) => UserLowId == me ? UserHighId : UserLowId;
}
