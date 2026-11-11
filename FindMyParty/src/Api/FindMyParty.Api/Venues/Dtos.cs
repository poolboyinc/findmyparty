using System.Text.Json.Serialization;
using FindMyParty.Api.Parties;

namespace FindMyParty.Api.Venues;

public record VenueSummary(Guid Id, string Name, double Latitude, double Longitude, string? CrowdLevel, string? CrowdSource, Guid? PartyId, string? PartyTitle)
{
    /// <summary>Fields other features add (see IVenueEnricher). Each key is written as an ordinary JSON property.</summary>
    [JsonExtensionData] public Dictionary<string, object?> Extra { get; set; } = new();
}

public record VenueResponse(Guid Id, string Name, string Address, double Latitude, double Longitude, TimeOnly? WorkingHoursOpen, TimeOnly? WorkingHoursClose, string? WorkingDays, string? CrowdLevel, string? CrowdSource, List<PartyResponse> Parties)
{
    /// <summary>Fields other features add (see IVenueDetailEnricher). Each key is written as an ordinary JSON property.</summary>
    [JsonExtensionData] public Dictionary<string, object?> Extra { get; set; } = new();
}
