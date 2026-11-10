using FindMyParty.Api.Parties;

namespace FindMyParty.Api.Venues;

public record VenueSummary(Guid Id, string Name, double Latitude, double Longitude, string? CrowdLevel, string? CrowdSource, Guid? PartyId, string? PartyTitle);
public record VenueResponse(Guid Id, string Name, string Address, double Latitude, double Longitude, TimeOnly? WorkingHoursOpen, TimeOnly? WorkingHoursClose, string? WorkingDays, string? CrowdLevel, string? CrowdSource, List<PartyResponse> Parties);
