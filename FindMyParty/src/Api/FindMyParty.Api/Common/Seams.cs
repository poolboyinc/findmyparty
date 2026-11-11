using FindMyParty.Api.Parties;
using FindMyParty.Api.Venues;

namespace FindMyParty.Api.Common;

// The places where one feature hooks into another's code. A feature implements the interface and registers it
// in its IFeature; the code that owns the moment (a feed, a scan, a booking, an account deletion) calls every one.

/// <summary>Adds viewer-specific or cross-feature fields to the party feed by writing camelCase keys into `Extra`.</summary>
public interface IPartyEnricher { Task EnrichAsync(IReadOnlyList<PartyResponse> parties, Guid? viewerId, CancellationToken ct); }
public interface IPartyDetailEnricher { Task EnrichAsync(PartyDetailResponse party, Guid? viewerId, CancellationToken ct); }
public interface IVenueEnricher { Task EnrichAsync(IReadOnlyList<VenueSummary> venues, Guid? viewerId, CancellationToken ct); }
public interface IVenueDetailEnricher { Task EnrichAsync(VenueResponse venue, Guid? viewerId, CancellationToken ct); }

/// <summary>One scan at the door. `FirstForGuest` is true on the first scan that lets this guest's pass in.</summary>
public record CheckInEvent(Guid CheckInId, Guid BookingId, Guid PartyId, Guid? VenueId, Guid GuestUserId,
                           int Admitted, DateTime At, bool FirstForGuest);

/// <summary>Called after the scan has committed. A listener that throws is logged and never fails the scan.</summary>
public interface ICheckInListener { Task OnCheckedInAsync(CheckInEvent e, CancellationToken ct); }

public record PerkQuote(string? PerkKey, string? Title, int AppliesToGuests, decimal Discount, DateTime? ValidUntil, bool SkipLine);

/// <summary>The perk a guest gets on a booking, or null. Asked at quote time and when the booking is made.</summary>
public interface IBookingPricer { Task<PerkQuote?> QuoteAsync(Guid userId, Guid partyId, int ticketCount, DateTime nowUtc, CancellationToken ct); }

/// <summary>Removes or anonymises a feature's rows for a deleted account. Runs inside the delete transaction.</summary>
public interface IAccountCleanup { Task DeleteAsync(Guid userId, CancellationToken ct); }

/// <summary>May this user scan at this venue, and under which door name? Default: the venue's host only ("Host").</summary>
public interface IVenueAccess { Task<string?> DoorNameAsync(Guid userId, Guid venueId, CancellationToken ct); }

public enum NotifyCategory { Transactional, Venues, Friends, Nights }

public record Push(IReadOnlyCollection<Guid> UserIds, string Type, string Title, string Body,
                   object? Data = null, NotifyCategory Category = NotifyCategory.Transactional);

/// <summary>Sends a push to every device of the users named. Never throws, never blocks the request.</summary>
public interface INotifier { Task SendAsync(Push push, CancellationToken ct = default); }

public interface IEmailSender { Task SendAsync(string to, string subject, string html, string text, CancellationToken ct = default); }
