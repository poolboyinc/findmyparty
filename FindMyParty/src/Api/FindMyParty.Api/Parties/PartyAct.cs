namespace FindMyParty.Api.Parties;

/// <summary>One act on a party's line-up: who plays, as what, from when.</summary>
public class PartyAct
{
    public Guid Id { get; set; }
    public Guid PartyId { get; set; }
    public string Name { get; set; } = default!;
    /// <summary>"DJ", "Band", "Live"…; free text.</summary>
    public string? Role { get; set; }
    public DateTime StartsAt { get; set; }
    /// <summary>Place in the line-up, in time order from 0.</summary>
    public int Order { get; set; }
}
