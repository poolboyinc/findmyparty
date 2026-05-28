using System.ComponentModel.DataAnnotations;

namespace FindMyParty.Identity.API.Application.DTOs
{
    /// <summary>
    /// Host-editable subset of the venue profile. Location (Address / Latitude /
    /// Longitude) is intentionally NOT here — it stays admin-managed so venues
    /// can't silently move themselves on the map.
    /// </summary>
    public record UpdateMyVenueProfileRequest(
        [property: Required, StringLength(120)] string VenueName,
        TimeOnly? WorkingHoursOpen,
        TimeOnly? WorkingHoursClose,
        /// <summary>Comma-separated active day codes, e.g. "MON,TUE,WED". Max 27 chars (all 7 days).</summary>
        [property: StringLength(50)] string? WorkingDays);
}
