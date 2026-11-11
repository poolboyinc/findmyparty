using System.Text.Json;
using System.Text.Json.Serialization;
using FindMyParty.Api.Parties;

namespace FindMyParty.Api.Venues;

/// <summary>The venue's building: its outer ring as [lng, lat] points, and how tall it is.</summary>
public record Footprint(double[][] Ring, double HeightM)
{
    /// <summary>Used when a ring is stored without a height.</summary>
    public const double DefaultHeightM = 12;

    /// <summary>From the stored jsonb ring and height; null when there is no ring or it cannot be read.</summary>
    public static Footprint? From(string? ringJson, double? heightM)
    {
        if (string.IsNullOrWhiteSpace(ringJson)) return null;
        try
        {
            var ring = JsonSerializer.Deserialize<double[][]>(ringJson);
            return ring is { Length: > 0 } ? new Footprint(ring, heightM ?? DefaultHeightM) : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }
}

public record FootprintRequest(double[][]? Ring, double? HeightM);

/// <summary>A venue on the map or in a list: one beam, with its next open party.</summary>
public class VenueSummary
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public string? CrowdLevel { get; set; }
    public string? CrowdSource { get; set; }
    public Guid? PartyId { get; set; }
    public string? PartyTitle { get; set; }
    public string City { get; set; } = null!;
    public string? Kind { get; set; }
    public string? Area { get; set; }
    public string? PartyGenre { get; set; }
    public decimal? PartyPrice { get; set; }
    public DateTime? PartyStartsAt { get; set; }
    public DateTime? PartyEndsAt { get; set; }
    public string? PartyLineupText { get; set; }
    public Footprint? Footprint { get; set; }

    /// <summary>Fields other features add (see IVenueEnricher). Each key is written as an ordinary JSON property.</summary>
    [JsonExtensionData] public Dictionary<string, object?> Extra { get; set; } = new();
}

/// <summary>One bar of "Tonight by hour". `at` is the start of the hour (UTC); `level` is 0–1.</summary>
public record VenueHour(DateTime At, double Level, string Kind);

/// <summary>S-11's crowd card: the hour chart, which way the night is going, and when it usually peaks.</summary>
public record VenueTonight(List<VenueHour> Hours, string? Trend, DateTime? UsualPeakAt);

/// <summary>A venue's page.</summary>
public class VenueResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public string Address { get; set; } = null!;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public TimeOnly? WorkingHoursOpen { get; set; }
    public TimeOnly? WorkingHoursClose { get; set; }
    public string? WorkingDays { get; set; }
    public string? CrowdLevel { get; set; }
    public string? CrowdSource { get; set; }
    public List<PartyResponse> Parties { get; set; } = [];
    public string City { get; set; } = null!;
    public string? Kind { get; set; }
    public string? Area { get; set; }
    public string? ImageUrl { get; set; }
    public Footprint? Footprint { get; set; }
    /// <summary>False when signed out.</summary>
    public bool Following { get; set; }
    /// <summary>Null when nothing is on tonight.</summary>
    public VenueTonight? Tonight { get; set; }

    /// <summary>Fields other features add (see IVenueDetailEnricher). Each key is written as an ordinary JSON property.</summary>
    [JsonExtensionData] public Dictionary<string, object?> Extra { get; set; } = new();
}
