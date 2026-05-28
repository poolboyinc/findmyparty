namespace FindMyParty.Parties.API.Application.DTOs
{
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
        /// <summary>Tickets sold so far — surfaced to the consumer feed as the
        /// attendee count. Denormalized via the booking events.</summary>
        public int AttendeeCount { get; set; }
    }
}
