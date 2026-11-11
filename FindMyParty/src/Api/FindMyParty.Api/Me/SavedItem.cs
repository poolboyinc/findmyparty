namespace FindMyParty.Api.Me;

/// <summary>A party or a venue a user saved ("Saved venues and parties" on Me). One row per user, kind and target.</summary>
public class SavedItem
{
    public const string Party = "party";
    public const string Venue = "venue";

    public Guid UserId { get; set; }
    /// <summary>`party` or `venue`.</summary>
    public string Kind { get; set; } = default!;
    /// <summary>The party's or the venue's id.</summary>
    public Guid TargetId { get; set; }
    public DateTime CreatedAt { get; set; }

    /// <summary>The kind as the path writes it, or null when it is neither.</summary>
    public static string? KindFrom(string? value) => value?.Trim().ToLowerInvariant() switch
    {
        Party => Party,
        Venue => Venue,
        _ => null
    };
}
