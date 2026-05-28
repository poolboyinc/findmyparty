namespace FindMyParty.Bookings.API.Application.DTOs;

// Mirrors Parties.API's BookingPartyDto. Duplicated by design — Bookings.API
// must NOT take a project reference on Parties.API; this is the microservice
// boundary. Field shape and ordering must stay in sync with the producer.
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
