namespace FindMyParty.Parties.API.Application.DTOs;

public class PartyDetailResponse
{
    public Guid Id { get; set; }
    public string Title { get; set; } = null!;
    public string Description { get; set; } = null!;
    public decimal Price { get; set; }
    public int Capacity { get; set; }
    public int TicketsSold { get; set; }
    public int RemainingCapacity => Capacity - TicketsSold;
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public bool IsSoldOut { get; set; }
}
