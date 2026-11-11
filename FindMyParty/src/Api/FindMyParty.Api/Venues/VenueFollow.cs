namespace FindMyParty.Api.Venues;

/// <summary>A guest follows a venue: they get a push when it publishes a party.</summary>
public class VenueFollow
{
    public Guid UserId { get; set; }
    public Guid VenueId { get; set; }
    public DateTime CreatedAt { get; set; }
}
