namespace FindMyParty.Mobile.Models.Auth;

public class UserInfo
{
    public string Email { get; set; } = null!;
    public string UserName { get; set; } = null!;
    public string Subscription { get; set; } = null!;
    public string Role { get; set; } = null!;

    public string Initial => Email.Length > 0 ? Email[0].ToString().ToUpper() : "?";
    public bool IsPremium => Subscription == "Premium";
    public string SubscriptionColor => IsPremium ? "#A78BFA" : "#888888";
    public string SubscriptionBackgroundColor => IsPremium ? "#2D1B69" : "#1C1C1C";
    public string SubscriptionBorderColor => IsPremium ? "#7C3AED" : "#333333";
}
