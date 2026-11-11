using FindMyParty.Api.Common;

namespace FindMyParty.Api.Bookings;

public enum BookingStatus
{
    Pending = 1,
    Confirmed = 2,
    Cancelled = 3,
    /// <summary>Nobody was scanned in before the hold ended: the spots went back to the door.</summary>
    Expired = 4
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
    /// <summary>Guests from this booking already let in at the door: the booker's group and guest-pass holders together.</summary>
    public int CheckedInCount { get; private set; }
    public DateTime? FirstCheckedInAt { get; private set; }
    /// <summary>Key for this booking's rotating door code. Only the guest's phone and the server know it.</summary>
    public string PassSecret { get; private set; } = string.Empty;

    /// <summary>Until when the spots are kept while nobody on the booking has been scanned in. After that they go back to the door.</summary>
    public DateTime HeldUntil { get; private set; }
    public DateTime? HoldReminderSentAt { get; private set; }

    // The perk fixed when the booking was made (from IBookingPricer). The discount is used once, on the main pass's first admission.
    public string? PerkKey { get; private set; }
    public string? PerkTitle { get; private set; }
    public decimal PerkDiscount { get; private set; }
    public int PerkGuests { get; private set; }
    public DateTime? PerkValidUntil { get; private set; }
    public bool SkipLine { get; private set; }

    /// <summary>Guest passes handed out and not taken back (scanned ones included). Each holds one spot of TicketCount.</summary>
    public int GuestSpots { get; private set; }
    /// <summary>Guest passes scanned in. Part of CheckedInCount.</summary>
    public int GuestsIn { get; private set; }

    protected Booking() { }

    /// <param name="heldUntil">When the hold ends. Left out, the booking is held until the party ends (demo data).</param>
    public Booking(Guid userId, Guid partyId, int ticketCount, decimal pricePerTicket, string idempotencyKey, DateTime partyEndsAt,
        DateTime? heldUntil = null, DateTime? createdAt = null)
    {
        Id = Guid.NewGuid();
        UserId = userId;
        PartyId = partyId;
        TicketCount = ticketCount;
        TotalPrice = ticketCount * pricePerTicket;
        Status = BookingStatus.Pending;
        CreatedAt = createdAt ?? DateTime.UtcNow;
        IdempotencyKey = idempotencyKey;
        PartyEndsAt = partyEndsAt;
        HeldUntil = heldUntil ?? partyEndsAt;
        PassSecret = PassCode.NewSecret();
    }

    public decimal PricePerGuest => TicketCount == 0 ? 0 : TotalPrice / TicketCount;

    /// <summary>The booker's own group already let in.</summary>
    public int MainAdmitted => CheckedInCount - GuestsIn;

    /// <summary>Guests the booker's own code still lets in.</summary>
    public int MainOutside => TicketCount - GuestSpots - MainAdmitted;

    public bool IsActive => Status is BookingStatus.Pending or BookingStatus.Confirmed;

    /// <summary>Nobody on the booking is inside and the hold is over at this moment.</summary>
    public bool HoldOverAt(DateTime at) => CheckedInCount == 0 && at > HeldUntil;

    /// <summary>The discount the main pass gets when scanned at this moment: only on its first admission, while the perk is valid.</summary>
    public decimal DiscountAt(DateTime at) =>
        PerkDiscount > 0 && MainAdmitted == 0 && (PerkValidUntil is null || at <= PerkValidUntil) ? PerkDiscount : 0;

    /// <summary>What to collect when the main pass lets `admit` guests in at this moment.</summary>
    public decimal DueFor(int admit, DateTime at) => Math.Max(0, admit * PricePerGuest - DiscountAt(at));

    /// <summary>Stores the pricer's answer. Only a perk with a key and a discount is a priced perk; skip-the-line comes on its own.</summary>
    public void FixPerk(PerkQuote? perk)
    {
        SkipLine = perk?.SkipLine ?? false;
        if (perk is not { PerkKey: not null } || perk.Discount <= 0) return;
        PerkKey = perk.PerkKey;
        PerkTitle = perk.Title;
        PerkDiscount = Math.Min(perk.Discount, TotalPrice);
        PerkGuests = Math.Max(perk.AppliesToGuests, 1);
        PerkValidUntil = perk.ValidUntil;
    }

    public void AdmitMain(int admit, DateTime at)
    {
        CheckedInCount += admit;
        // An offline scan replayed late may have happened before one that reached the server first.
        FirstCheckedInAt = FirstCheckedInAt is { } first && first <= at ? first : at;
        Status = BookingStatus.Confirmed;
    }

    public void AdmitGuest(DateTime at)
    {
        GuestsIn++;
        AdmitMain(1, at);
    }

    public void AddGuestSpot() => GuestSpots++;
    public void RemoveGuestSpot() => GuestSpots--;
    public void Cancel() => Status = BookingStatus.Cancelled;
}

/// <summary>One scan at the door: who was let in, how many, when, by whom, at which door, and what was collected.</summary>
public class CheckIn
{
    public Guid Id { get; set; }
    public Guid BookingId { get; set; }
    public Guid PartyId { get; set; }
    public int Admitted { get; set; }
    public DateTime At { get; set; }
    public Guid ByUserId { get; set; }
    /// <summary>Who came in: the booker, or the holder of a guest pass.</summary>
    public Guid GuestUserId { get; set; }
    /// <summary>The door that scanned: "Host" or a door login's name ("Door 1").</summary>
    public string DoorName { get; set; } = HostOnlyVenueAccess.HostDoorName;
    /// <summary>What the door collected for this scan, after any perk.</summary>
    public decimal AmountDue { get; set; }
    /// <summary>The door phone's id for this scan; the same id again returns the first answer.</summary>
    public Guid? ClientScanId { get; set; }
    /// <summary>Set when a guest pass (not the booker's own code) was scanned.</summary>
    public Guid? GuestPassId { get; set; }
}

/// <summary>A link worth one spot of a booking, handed to someone else. Its holder gets their own rotating code.</summary>
public class GuestPass
{
    public Guid Id { get; set; }
    public Guid BookingId { get; set; }
    /// <summary>The secret in the link (/g/{token}).</summary>
    public string Token { get; set; } = default!;
    public string PassSecret { get; set; } = default!;
    public Guid? ClaimedByUserId { get; set; }
    public DateTime? ClaimedAt { get; set; }
    public DateTime? CheckedInAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public DateTime CreatedAt { get; set; }

    public string State => CheckedInAt is not null ? "in" : ClaimedByUserId is not null ? "claimed" : "unclaimed";
}
