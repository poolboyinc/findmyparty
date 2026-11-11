using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FindMyParty.Api.Signs;

/// <summary>
/// A sign booked for a week on a spot (facade, hologram), or for one night as a "Slot in Tonight". Every booking a
/// host makes waits for the platform admin; nothing is charged, the price is recorded "to invoice".
/// </summary>
public class SignBooking
{
    public const string TonightSlot = "tonightSlot";
    public static readonly string[] Formats = [SignSpot.Facade, SignSpot.Hologram, TonightSlot];

    public const string PendingReview = "pendingReview";
    public const string Approved = "approved";
    public const string Rejected = "rejected";
    public const string Cancelled = "cancelled";
    public const string ToInvoice = "toInvoice";
    public const string Invoiced = "invoiced";

    public Guid Id { get; set; }
    public string Format { get; set; } = SignSpot.Facade;
    public Guid? SpotId { get; set; }
    public Guid BookedByUserId { get; set; }
    public Guid? VenueId { get; set; }
    public Guid? PartyId { get; set; }
    public Guid? PerkId { get; set; }
    public string AdvertiserName { get; set; } = default!;
    /// <summary>Up to 24 characters; `|` breaks it into two lines.</summary>
    public string Text { get; set; } = default!;
    public string ColorTop { get; set; } = default!;
    public string ColorBottom { get; set; } = default!;
    public string Ink { get; set; } = default!;
    public string? ArtworkUrl { get; set; }
    public string? CardTitle { get; set; }
    public string? CardSubtitle { get; set; }
    /// <summary>First and last night it is up (both included), in the city's time.</summary>
    public DateOnly StartsOn { get; set; }
    public DateOnly EndsOn { get; set; }
    public decimal Price { get; set; }
    public string Status { get; set; } = PendingReview;
    public string? ReviewNote { get; set; }
    public Guid? ReviewedByUserId { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string InvoiceStatus { get; set; } = ToInvoice;
    public DateTime CreatedAt { get; set; }

    /// <summary>Holds its spot or slot: waiting for review, or approved.</summary>
    public static bool Holds(string status) => status is PendingReview or Approved;
}

public class SignBookingConfig : IEntityTypeConfiguration<SignBooking>
{
    public void Configure(EntityTypeBuilder<SignBooking> b)
    {
        b.HasKey(x => x.Id);
        b.Property(x => x.Format).HasMaxLength(12).IsRequired();
        b.Property(x => x.AdvertiserName).HasMaxLength(40).IsRequired();
        b.Property(x => x.Text).HasMaxLength(25).IsRequired(); // 24 characters and the line break
        b.Property(x => x.ColorTop).HasMaxLength(7).IsRequired();
        b.Property(x => x.ColorBottom).HasMaxLength(7).IsRequired();
        b.Property(x => x.Ink).HasMaxLength(7).IsRequired();
        b.Property(x => x.ArtworkUrl).HasMaxLength(2000);
        b.Property(x => x.CardTitle).HasMaxLength(80);
        b.Property(x => x.CardSubtitle).HasMaxLength(120);
        b.Property(x => x.Price).HasPrecision(18, 2);
        b.Property(x => x.Status).HasMaxLength(16).IsRequired();
        b.Property(x => x.ReviewNote).HasMaxLength(300);
        b.Property(x => x.InvoiceStatus).HasMaxLength(10).IsRequired();
        b.HasIndex(x => new { x.SpotId, x.StartsOn });
        b.HasIndex(x => x.Status);
        b.HasIndex(x => x.PartyId);
        b.HasIndex(x => x.BookedByUserId);
    }
}

/// <summary>A viewer chose "Hide" on a sign's card: it is gone for them.</summary>
public class SignHide
{
    public Guid UserId { get; set; }
    public Guid SignBookingId { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class SignHideConfig : IEntityTypeConfiguration<SignHide>
{
    public void Configure(EntityTypeBuilder<SignHide> h) => h.HasKey(x => new { x.UserId, x.SignBookingId });
}
