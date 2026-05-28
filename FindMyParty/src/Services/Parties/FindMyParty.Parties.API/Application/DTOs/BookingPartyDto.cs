namespace FindMyParty.Parties.API.Application.DTOs;

// Slim party projection for ticket-card rendering on the bookings screen.
// Intentionally omits price, capacity, ticketsSold, description — those are
// sensitive / unnecessary for a "my bookings" card. Status is included so the
// client can render a cancelled badge when a host cancelled AFTER the booking
// was made.
public record BookingPartyDto(
    Guid Id,
    string Title,
    string? ImageUrl,
    DateTime StartsAt,
    DateTime EndsAt,
    double Latitude,
    double Longitude,
    string? Genre,
    string? PerformerName,
    string? PerformerType,
    string Status);
