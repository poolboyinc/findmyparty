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
    /// <summary>Guests from this booking already let in at the door.</summary>
    public int CheckedInCount { get; private set; }
    public DateTime? FirstCheckedInAt { get; private set; }
    /// <summary>Key for this booking's rotating door code. Only the guest's phone and the server know it.</summary>
    public string PassSecret { get; private set; } = string.Empty;

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
        PassSecret = PassCode.NewSecret();
    }
}

/// <summary>One scan at the door: who was let in, how many, when, by whom.</summary>
public class CheckIn
{
    public Guid Id { get; set; }
    public Guid BookingId { get; set; }
    public Guid PartyId { get; set; }
    public int Admitted { get; set; }
    public DateTime At { get; set; }
    public Guid ByUserId { get; set; }
}

public record PassResponse(
    Guid BookingId,
    string Secret,
    int StepSeconds,
    int TicketCount,
    int CheckedInCount,
    string Status,
    Guid PartyId,
    string PartyTitle,
    string? VenueName,
    DateTime StartsAt,
    DateTime EndsAt,
    decimal TotalPrice);

public record CheckInRequest(string? Code, int? Admit);

public record CheckInResponse(
    Guid BookingId,
    string GuestName,
    int Admitted,
    int TicketCount,
    int CheckedInCount,
    decimal AmountDue,
    string PartyTitle);

/// <summary>What the door sees before letting anyone in. Nothing has changed yet.</summary>
public record CheckInPreview(
    Guid BookingId,
    string GuestName,
    int TicketCount,
    int CheckedInCount,
    int Outside,
    decimal PricePerGuest,
    string PartyTitle);

public record ArrivalBucket(DateTime From, int Count);

public record LiveResponse(
    int Capacity,
    int PassesOut,
    int CheckedIn,
    int NotHereYet,
    decimal TakenAtDoor,
    List<ArrivalBucket> Arrivals);

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
    BookingPartyDto? Party,
    int CheckedInCount = 0,
    DateTime? FirstCheckedInAt = null);
