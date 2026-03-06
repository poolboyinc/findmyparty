namespace FindMyParty.Mobile.Models.Bookings;

public class BookingItem
{
    public Guid Id { get; set; }
    public Guid PartyId { get; set; }
    public int TicketCount { get; set; }
    public decimal TotalPrice { get; set; }
    public string Status { get; set; } = null!;
    public DateTime CreatedAt { get; set; }

    public string StatusColor => Status switch
    {
        "Confirmed" => "#22C55E",
        "Cancelled" => "#6B7280",
        _ => "#F59E0B"   // Pending
    };

    public string StatusBackgroundColor => Status switch
    {
        "Confirmed" => "#0A2D0A",
        "Cancelled" => "#1C1C1C",
        _ => "#2D1F00"   // Pending
    };

    public string StatusBorderColor => Status switch
    {
        "Confirmed" => "#22C55E",
        "Cancelled" => "#4B5563",
        _ => "#F59E0B"   // Pending
    };
}
