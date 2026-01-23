namespace FindMyParty.Parties.API.Application.DTOs
{
    public class CreatePartyRequest
    {
        public string Title { get; set; } = null!;
        public string Description { get; set; } = null!;
        public decimal Price { get; set; }
        public int Capacity { get; set; }
        public DateTime StartsAt { get; set; }
        public DateTime EndsAt { get; set; }
        public double Latitude { get; set; }
        public double Longitude { get; set; }
    }
}
