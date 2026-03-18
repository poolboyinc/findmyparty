namespace FindMyParty.Identity.API.Application.DTOs
{
    public record SetVenueProfileRequest(
        string VenueName,
        string Address,
        double Latitude,
        double Longitude);
}
