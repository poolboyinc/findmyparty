namespace FindMyParty.Identity.API.Domain.Entities
{
    public class VenueProfile
    {
        public Guid Id { get; set; }

        public string UserId { get; set; } = default!;

        public string VenueName { get; set; } = default!;

        public string Address { get; set; } = default!;

        public double Latitude { get; set; }

        public double Longitude { get; set; }

        // Host-editable schedule. All nullable so existing rows backfill cleanly
        // and new hosts can set them later from the admin Edit Profile screen.
        public TimeOnly? WorkingHoursOpen { get; set; }

        public TimeOnly? WorkingHoursClose { get; set; }

        /// <summary>Comma-separated active days, e.g. "MON,TUE,WED". Null when not set.</summary>
        public string? WorkingDays { get; set; }

        public ApplicationUser User { get; set; } = default!;
    }
}
