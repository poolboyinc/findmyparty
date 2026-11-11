using System.Globalization;

namespace FindMyParty.Api.Bookings;

// The JSON shapes of spec §2.5 "bookings and passes", "the door" and PartyLive. Names follow the spec,
// with Response where a class of the spec's name already exists (Booking, GuestPass, DoorStaff).

public record CreateBookingRequest(Guid PartyId, int TicketCount);

public record QuotePerk(string PerkKey, string? Title, int AppliesToGuests, decimal Discount, DateTime? ValidUntil);

public record BookingQuote(
    Guid PartyId, int TicketCount, int MaxGuests, decimal PricePerGuest, decimal Subtotal,
    QuotePerk? Perk, bool SkipLine, decimal TotalAtDoor, DateTime HeldUntil, bool PayNowAvailable = false);

public record GuestPassResponse(Guid Id, string Status, string? GuestName, string Url, DateTime CreatedAt);

public record GuestPassPreview(string PartyTitle, string? VenueName, DateTime StartsAt, string HostName, string Status);

public record ClaimGuestPassRequest(string? Token);

public record BookingPartyResponse(
    Guid Id, string Title, string? ImageUrl, DateTime StartsAt, DateTime EndsAt, double Latitude, double Longitude,
    string? Genre, string? PerformerName, string? PerformerType, string Status, Guid? VenueId, string? VenueName, string? VenueArea);

/// <summary>A row of "my bookings": a booking of mine, or a guest pass someone gave me (then `Id` is the guest pass id).</summary>
public record BookingResponse(
    Guid Id, Guid PartyId, int TicketCount, decimal TotalPrice, string Status, DateTime CreatedAt, DateTime PartyEndsAt,
    BookingPartyResponse? Party, int CheckedInCount, DateTime? FirstCheckedInAt,
    DateTime? HeldUntil, string? PerkTitle, decimal PerkDiscount, decimal AmountDue, bool SkipLine,
    List<GuestPassResponse> GuestPasses, Guid? GuestPassId, string? GuestOf);

public record PassResponse(
    Guid BookingId, string Kind, string CodePrefix, string CodeId, string Secret, int StepSeconds, int TicketCount, int CheckedInCount,
    string Status, Guid PartyId, string PartyTitle, string? VenueName, string? VenueArea, DateTime StartsAt, DateTime EndsAt,
    decimal TotalPrice, int Admit, decimal AmountDue, string? PerkTitle, bool SkipLine, DateTime? HeldUntil,
    string HolderName, string LevelName, string? GuestOf);

public record HostBookingResponse(
    Guid Id, Guid PartyId, int TicketCount, decimal TotalPrice, string Status, DateTime CreatedAt, DateTime PartyEndsAt,
    string GuestName, int CheckedInCount, DateTime? HeldUntil, decimal AmountDue);

// ── the door ──

public record CheckInRequest(string? Code, int? Admit, Guid? ClientScanId = null);

/// <summary>A line of what to collect. A discount has a negative amount.</summary>
public record MoneyLine(string Label, decimal Amount, bool Perk);

/// <summary>What the door sees before letting anyone in. Nothing has changed yet.</summary>
public record CheckInPreview(
    Guid BookingId, string Kind, Guid PartyId, string PartyTitle, string GuestName, string LevelName,
    int TicketCount, int CheckedInCount, int Outside, decimal PricePerGuest, List<MoneyLine> Lines, List<decimal> DueByAdmit, bool SkipLine);

public record CheckInResult(
    Guid BookingId, string GuestName, string LevelName, int Admitted, int TicketCount, int CheckedInCount,
    decimal AmountDue, string PartyTitle, string Door, Guid? ClientScanId);

public record BatchScanItem(Guid ClientScanId, string? Code, int Admit, DateTime ScannedAt);
public record BatchScanRequest(List<BatchScanItem>? Items);

public record BatchScanResult(Guid ClientScanId, string Status, CheckInResult? Result = null, string? Code = null, string? Title = null);
public record BatchScanResponse(List<BatchScanResult> Results);

public record ArrivalBucket(DateTime From, int Count);

public record PartyBeam(int Rank, int Of, string Level, string? LeaderName, string? RunnerUpName);

public record PartyLive(
    string PartyTitle, DateTime StartsAt, DateTime EndsAt, string Status,
    int Capacity, int PassesOut, int CheckedIn, int NotHereYet, decimal TakenAtDoor,
    List<ArrivalBucket> Arrivals, int NewFaces, PartyBeam? Beam);

/// <summary>Money as the app writes it: "€5", "€7.50", "Free".</summary>
public static class Money
{
    public static string Format(decimal amount) =>
        amount == 0 ? "Free"
        : amount == decimal.Truncate(amount) ? "€" + amount.ToString("0", CultureInfo.InvariantCulture)
        : "€" + amount.ToString("0.00", CultureInfo.InvariantCulture);
}
