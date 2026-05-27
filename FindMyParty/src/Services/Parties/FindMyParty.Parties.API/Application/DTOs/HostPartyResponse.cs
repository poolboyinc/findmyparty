namespace FindMyParty.Parties.API.Application.DTOs
{
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
        /// <summary>Derived: TicketsSold × Price. Exact because pricing is flat
        /// (one Price per party, editable only while Draft) and TicketsSold is
        /// denormalized via BookingCreated/Cancelled events.</summary>
        public decimal Revenue { get; set; }
        public string? Genre { get; set; }
        public string? PerformerName { get; set; }
        public string? PerformerType { get; set; }
        public bool Featured { get; set; }
    }
}
