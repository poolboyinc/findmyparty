using FindMyParty.Api.Parties;

namespace FindMyParty.Api.Bookings;

public enum BookingStatus
{
    Pending = 1,
    Confirmed = 2,
    Cancelled = 3
}

public class Booking
{
    public Guid Id { get; private set; }
    public Guid UserId { get; private set; }
    public Guid PartyId { get; private set; }
    public string IdempotencyKey { get; private set; } = string.Empty;
    public int TicketCount { get; private set; }
    public decimal TotalPrice { get; private set; }
    public BookingStatus Status { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime PartyEndsAt { get; private set; }

    protected Booking() { }

    public Booking(Guid userId, Guid partyId, int ticketCount, decimal pricePerTicket, string idempotencyKey, DateTime partyEndsAt)
    {
        Id = Guid.NewGuid();
        UserId = userId;
        PartyId = partyId;
        TicketCount = ticketCount;
        TotalPrice = ticketCount * pricePerTicket;
        Status = BookingStatus.Pending;
        CreatedAt = DateTime.UtcNow;
        IdempotencyKey = idempotencyKey;
        PartyEndsAt = partyEndsAt;
    }
}

public record CreateBookingRequest(Guid PartyId, int TicketCount);

public class BookingResponse
{
    public Guid Id { get; set; }
    public Guid PartyId { get; set; }
    public int TicketCount { get; set; }
    public decimal TotalPrice { get; set; }
    public string Status { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public DateTime PartyEndsAt { get; set; }
}

public record UserBookingResponse(
    Guid Id,
    Guid PartyId,
    int TicketCount,
    decimal TotalPrice,
    string Status,
    DateTime CreatedAt,
    DateTime PartyEndsAt,
    BookingPartyDto? Party);
