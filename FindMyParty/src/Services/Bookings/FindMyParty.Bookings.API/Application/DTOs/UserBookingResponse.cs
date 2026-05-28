namespace FindMyParty.Bookings.API.Application.DTOs;

// Enriched booking row for GET /api/bookings/my. Party is nullable so a failed
// cross-service lookup or a since-deleted party still renders the row with a
// placeholder on the client.
public record UserBookingResponse(
    Guid Id,
    Guid PartyId,
    int TicketCount,
    decimal TotalPrice,
    string Status,
    DateTime CreatedAt,
    DateTime PartyEndsAt,
    BookingPartyDto? Party);
