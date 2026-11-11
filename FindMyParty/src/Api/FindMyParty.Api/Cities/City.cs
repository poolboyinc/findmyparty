namespace FindMyParty.Api.Cities;

/// <summary>A city FindMyParty is in. Venues and accounts point at it by slug.</summary>
public class City
{
    public string Slug { get; set; } = default!;
    public string Name { get; set; } = default!;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public double RadiusKm { get; set; }
    /// <summary>IANA name, e.g. Europe/Podgorica.</summary>
    public string TimeZone { get; set; } = default!;
    public int Order { get; set; }

    public const string Default = "podgorica";

    /// <summary>The cities the database starts with. CityClock reads time zones from here.</summary>
    public static readonly IReadOnlyList<City> All =
    [
        Of("podgorica", "Podgorica", 42.4419, 19.2632, 1),
        Of("budva", "Budva", 42.2911, 18.8403, 2),
        Of("niksic", "Nikšić", 42.7731, 18.9445, 3),
        Of("kotor", "Kotor", 42.4247, 18.7712, 4),
        Of("tivat", "Tivat", 42.4304, 18.6962, 5),
        Of("herceg-novi", "Herceg Novi", 42.4531, 18.5375, 6),
    ];

    private static City Of(string slug, string name, double latitude, double longitude, int order) => new()
    {
        Slug = slug, Name = name, Latitude = latitude, Longitude = longitude, RadiusKm = 12, TimeZone = "Europe/Podgorica", Order = order
    };
}
