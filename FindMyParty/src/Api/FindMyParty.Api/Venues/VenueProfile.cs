namespace FindMyParty.Api.Identity;

/// <summary>A venue: one per host. (The namespace is Identity for historical reasons; the file lives with venues.)</summary>
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

    /// <summary>The city this venue is in. A party's city is its venue's.</summary>
    public string CitySlug { get; set; } = Cities.City.Default;
    /// <summary>"Club", "Bar", "Rooftop", "Garden", "Warehouse".</summary>
    public string? Kind { get; set; }
    /// <summary>The part of town, e.g. "Stara Varoš".</summary>
    public string? Area { get; set; }
    public string? ImageUrl { get; set; }
    /// <summary>The outer ring of the venue's building as JSON: [[lng,lat],…].</summary>
    public string? Footprint { get; set; }
    public double? BuildingHeightM { get; set; }

    public ApplicationUser User { get; set; } = default!;
}
