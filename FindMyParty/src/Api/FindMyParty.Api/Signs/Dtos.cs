namespace FindMyParty.Api.Signs;

public record SignSpotDto(
    Guid Id, string City, int Number, string Format, string Label, string Area, double Latitude, double Longitude,
    double BearingDeg, double BaseHeightM, double WidthM, double HeightM, double BuildingHeightM, Guid? VenueId,
    decimal WeeklyPrice, bool Free);

public record SignSpotInput(
    string? City, int Number, string? Format, string? Label, string? Area, double Latitude, double Longitude,
    double BearingDeg, double BaseHeightM, double WidthM, double HeightM, double BuildingHeightM, Guid? VenueId,
    decimal? WeeklyPrice, bool Active = true);

public record MapSignCard(string Title, string Subtitle, string LogoText, Guid? PerkId, Guid? PartyId, Guid? VenueId, int? GlowCost);

public record MapSign(
    Guid Id, string Format, bool Own, string Advertiser, string Text, string ColorTop, string ColorBottom, string Ink,
    string? ArtworkUrl, SignSpotDto Spot, MapSignCard Card);

public record SignWeek(string Id, DateOnly StartsOn, DateOnly EndsOn, string Label);

public record SignFormatInfo(string Format, string Title, decimal Price, string Unit, int Total, int Free);

public class SignBookingDto
{
    public Guid Id { get; init; }
    public string Format { get; init; } = default!;
    public SignSpotDto? Spot { get; init; }
    public Guid? PartyId { get; init; }
    public string? PartyTitle { get; init; }
    public string Text { get; init; } = default!;
    public string ColorTop { get; init; } = default!;
    public string ColorBottom { get; init; } = default!;
    public string Ink { get; init; } = default!;
    public string? ArtworkUrl { get; init; }
    public DateOnly StartsOn { get; init; }
    public DateOnly EndsOn { get; init; }
    public decimal Price { get; init; }
    public string Status { get; init; } = default!;
    public string? ReviewNote { get; init; }
    public string InvoiceStatus { get; init; } = default!;
    public DateTime CreatedAt { get; init; }
}

public class AdminSignDto : SignBookingDto
{
    public string AdvertiserName { get; init; } = default!;
    public string? VenueName { get; init; }
    public string BookedBy { get; init; } = default!;
}

public record SignParty(Guid Id, string Title, DateTime StartsAt, string? ImageUrl);

public record SignOptions(SignWeek Week, List<SignWeek> Weeks, List<SignFormatInfo> Formats, List<SignSpotDto> Spots,
    List<SignParty> Parties, List<SignBookingDto> Mine);

public record SignInput(
    string? Format, Guid? SpotId, string? Week, Guid? PartyId, string? Text, string? ColorTop, string? ColorBottom, string? Ink,
    string? ArtworkUrl,
    // The admin's extras (ignored when a host books).
    string? AdvertiserName = null, Guid? VenueId = null, Guid? PerkId = null, string? CardTitle = null, string? CardSubtitle = null);

public record RejectInput(string? Note);
