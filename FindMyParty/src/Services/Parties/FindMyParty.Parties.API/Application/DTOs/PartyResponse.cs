namespace FindMyParty.Parties.API.Application.DTOs
{
    public class PartyResponse
    {
        public Guid Id { get; set; }
        public string Title { get; set; } = null!;
        public decimal Price { get; set; }
        public DateTime StartsAt { get; set; }
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public bool IsSoldOut { get; set; }
        public string? ImageUrl { get; set; }
    }
}
