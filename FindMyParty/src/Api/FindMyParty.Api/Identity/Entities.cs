using Microsoft.AspNetCore.Identity;

namespace FindMyParty.Api.Identity;

public enum SubscriptionType
{
    Free = 0,
    Premium = 1
}

public static class Roles
{
    public const string User = "User";
    public const string Host = "Host";
    public const string Admin = "Admin";
    public static readonly string[] All = [User, Host, Admin];
}

public class ApplicationUser : IdentityUser
{
    public SubscriptionType Subscription { get; set; } = SubscriptionType.Free;
}

public class VenueProfile
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = default!;
    public string VenueName { get; set; } = default!;
    public string Address { get; set; } = default!;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public TimeOnly? WorkingHoursOpen { get; set; }
    public TimeOnly? WorkingHoursClose { get; set; }
    public string? WorkingDays { get; set; }
    public ApplicationUser User { get; set; } = default!;
}
