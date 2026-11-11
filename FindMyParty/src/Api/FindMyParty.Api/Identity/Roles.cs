namespace FindMyParty.Api.Identity;

public static class Roles
{
    public const string User = "User";
    public const string Host = "Host";
    public const string Admin = "Admin";
    /// <summary>A venue's door login: the scanner and the in/capacity count, nothing else.</summary>
    public const string Door = "Door";
    public static readonly string[] All = [User, Host, Admin, Door];
}
