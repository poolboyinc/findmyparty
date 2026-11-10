using System.ComponentModel.DataAnnotations;

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

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (EndsAt <= StartsAt)
            yield return new ValidationResult("A party must end after it starts.", [nameof(EndsAt)]);
        if (EndsAt - StartsAt > TimeSpan.FromDays(7))
            yield return new ValidationResult("A party can last at most a week.", [nameof(EndsAt)]);
    }
}

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
    string Status);
