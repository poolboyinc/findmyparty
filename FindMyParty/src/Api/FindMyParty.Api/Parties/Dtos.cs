using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace FindMyParty.Api.Parties;

/// <summary>Body for creating and editing a party. "Featured" is not here on purpose: hosts cannot feature themselves.</summary>
public class PartyRequest : IValidatableObject
{
    [Required, StringLength(200, MinimumLength = 1)] public string Title { get; set; } = null!;
    [Required(AllowEmptyStrings = true), StringLength(4000)] public string Description { get; set; } = "";
    [Range(0, 100000)] public decimal Price { get; set; }
    [Range(1, 100000)] public int Capacity { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
    [Range(-90, 90)] public double Latitude { get; set; }
    [Range(-180, 180)] public double Longitude { get; set; }
    [StringLength(2000)] public string? ImageUrl { get; set; }
    [StringLength(100)] public string? Genre { get; set; }
    [StringLength(100)] public string? PerformerName { get; set; }
    [StringLength(100)] public string? PerformerType { get; set; }
    /// <summary>16, 18, 21, or null for no limit.</summary>
    public int? AgeLimit { get; set; }
    /// <summary>How long after the start a pass is held, 15–600 minutes; null means 90.</summary>
    [Range(15, 600)] public int? HoldMinutes { get; set; }
    /// <summary>The line-up, 0–8 acts. Null leaves the line-up as it is.</summary>
    public List<PartyActInput>? Acts { get; set; }

    public static readonly int[] AgeLimits = [16, 18, 21];

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (AgeLimit is { } age && !AgeLimits.Contains(age))
            yield return new ValidationResult("The age limit is 16, 18 or 21.", [nameof(AgeLimit)]);
        if (EndsAt <= StartsAt)
            yield return new ValidationResult("A party must end after it starts.", [nameof(EndsAt)]);
        if (EndsAt - StartsAt > TimeSpan.FromDays(7))
            yield return new ValidationResult("A party can last at most a week.", [nameof(EndsAt)]);
    }
}

/// <summary>An act as sent by the host. Checked by Lineup.Check (acts_invalid), not by model validation.</summary>
public record PartyActInput(string? Name, string? Role, DateTime? StartsAt);

/// <summary>An act as shown: "23:00 Lena K DJ".</summary>
public record PartyActDto(string Name, string? Role, DateTime StartsAt);

public record SetActsRequest(List<PartyActInput>? Acts);

public class PartyResponse
{
    public Guid Id { get; set; }
    public string Title { get; set; } = null!;
    public decimal Price { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public bool IsSoldOut { get; set; }
    public string? ImageUrl { get; set; }
    public string? Genre { get; set; }
    public int AttendeeCount { get; set; }
    public Guid? VenueId { get; set; }
    public string? VenueName { get; set; }
    /// <summary>How busy, as a range: "quiet", "20+", "50+", "100+", "200+". Never the exact number.</summary>
    public string? CrowdLevel { get; set; }
    /// <summary>"live" once guests have been scanned in at the door; "expected" while it is still based on passes taken.</summary>
    public string? CrowdSource { get; set; }
    /// <summary>The venue's city slug.</summary>
    public string? City { get; set; }
    public string? VenueArea { get; set; }
    public int? AgeLimit { get; set; }
    /// <summary>"Lena K, DJ Proximus".</summary>
    public string? LineupText { get; set; }

    /// <summary>Fields other features add (see IPartyEnricher). Each key is written as an ordinary JSON property.</summary>
    [JsonExtensionData] public Dictionary<string, object?> Extra { get; set; } = new();
}

public class PartyDetailResponse
{
    public Guid Id { get; set; }
    public string Title { get; set; } = null!;
    public string Description { get; set; } = null!;
    public decimal Price { get; set; }
    public int Capacity { get; set; }
    public int TicketsSold { get; set; }
    public int RemainingCapacity => Capacity - TicketsSold;
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public bool IsSoldOut { get; set; }
    public string? ImageUrl { get; set; }
    public Guid? VenueId { get; set; }
    public string? VenueName { get; set; }
    public string? Genre { get; set; }
    public string? PerformerName { get; set; }
    public string? PerformerType { get; set; }
    public string? CrowdLevel { get; set; }
    public string? CrowdSource { get; set; }
    public string? City { get; set; }
    public string? VenueArea { get; set; }
    public string? VenueAddress { get; set; }
    public int? AgeLimit { get; set; }
    public int HoldMinutes { get; set; }
    public List<PartyActDto> Acts { get; set; } = [];
    public string? LineupText { get; set; }

    /// <summary>Fields other features add (see IPartyDetailEnricher). Each key is written as an ordinary JSON property.</summary>
    [JsonExtensionData] public Dictionary<string, object?> Extra { get; set; } = new();
}

public class HostPartyResponse
{
    public Guid Id { get; set; }
    public string Title { get; set; } = null!;
    public string Description { get; set; } = null!;
    public decimal Price { get; set; }
    public int Capacity { get; set; }
    public int TicketsSold { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public string Status { get; set; } = null!;
    public string? ImageUrl { get; set; }
    public decimal Revenue { get; set; }
    public string? Genre { get; set; }
    public string? PerformerName { get; set; }
    public string? PerformerType { get; set; }
    public bool Featured { get; set; }
    public int? AgeLimit { get; set; }
    public int HoldMinutes { get; set; }
    public List<PartyActDto> Acts { get; set; } = [];
    public string? LineupText { get; set; }
}

/// <summary>Slim party data shown on a booking card.</summary>
public record BookingPartyDto(
    Guid Id,
    string Title,
    string? ImageUrl,
    DateTime StartsAt,
    DateTime EndsAt,
    double Latitude,
    double Longitude,
    string? Genre,
    string? PerformerName,
    string? PerformerType,
    string Status,
    Guid? VenueId = null,
    string? VenueName = null,
    string? VenueArea = null);
