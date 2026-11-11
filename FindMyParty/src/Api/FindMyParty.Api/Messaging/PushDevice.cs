namespace FindMyParty.Api.Messaging;

/// <summary>A phone that can get pushes, by its Expo push token. A token belongs to whoever registered it last.</summary>
public class PushDevice
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    /// <summary>"ExponentPushToken[…]".</summary>
    public string ExpoToken { get; set; } = default!;
    /// <summary>`ios` or `android`.</summary>
    public string Platform { get; set; } = default!;
    public DateTime CreatedAt { get; set; }
    public DateTime LastSeenAt { get; set; }
}
