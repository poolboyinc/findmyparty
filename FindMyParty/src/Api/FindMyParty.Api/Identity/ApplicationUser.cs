using Microsoft.AspNetCore.Identity;

namespace FindMyParty.Api.Identity;

public enum SubscriptionType
{
    Free = 0,
    Premium = 1
}

public class ApplicationUser : IdentityUser
{
    public SubscriptionType Subscription { get; set; } = SubscriptionType.Free;

    /// <summary>The name shown to others; null means the user name is shown.</summary>
    public string? DisplayName { get; set; }
    /// <summary>When the account was made. Filled by the database.</summary>
    public DateTime CreatedAt { get; set; }
    /// <summary>City slug.</summary>
    public string? HomeCity { get; set; }
    /// <summary>Genres in the order they were picked, comma-joined.</summary>
    public string? Taste { get; set; }

    /// <summary>All Glow ever earned; the level comes from this and never goes down.</summary>
    public int GlowLifetime { get; set; }
    /// <summary>Glow left to spend on sponsored perks.</summary>
    public int GlowBalance { get; set; }

    /// <summary>"Show me on friends' maps".</summary>
    public bool ShareWithFriends { get; set; }
    /// <summary>"Invisible tonight": hidden from friends until this moment.</summary>
    public DateTime? InvisibleUntil { get; set; }
    /// <summary>Set by an admin after a report; sharing cannot be switched on while it is set.</summary>
    public bool SharingSuspended { get; set; }

    public bool NotifyVenues { get; set; } = true;
    public bool NotifyFriends { get; set; } = true;
    public bool NotifyNights { get; set; } = true;

    /// <summary>Id of the user who invited them.</summary>
    public string? ReferredByUserId { get; set; }
}
