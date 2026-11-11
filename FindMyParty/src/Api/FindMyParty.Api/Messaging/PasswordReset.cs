namespace FindMyParty.Api.Messaging;

/// <summary>A reset link sent by mail. Only a hash of its token is kept; it works once, for two hours.</summary>
public class PasswordReset
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    /// <summary>SHA-256 of the token, as 64 hex characters.</summary>
    public string TokenHash { get; set; } = default!;
    public DateTime ExpiresAt { get; set; }
    public DateTime? UsedAt { get; set; }
}
