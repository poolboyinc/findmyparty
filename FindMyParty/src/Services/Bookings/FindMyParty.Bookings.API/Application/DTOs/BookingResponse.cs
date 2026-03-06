namespace FindMyParty.Bookings.API.Application.DTOs;

public class BookingResponse
{
    public Guid Id { get; set; }
    public Guid PartyId { get; set; }
    public int TicketCount { get; set; }
    public decimal TotalPrice { get; set; }
    public string Status { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
}
