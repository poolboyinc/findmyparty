namespace FindMyParty.Identity.API.Application.DTOs
{
    public record VenueProfileDto(
        string VenueId,
        string VenueName,
        string Address,
        double Latitude,
        double Longitude);
}
