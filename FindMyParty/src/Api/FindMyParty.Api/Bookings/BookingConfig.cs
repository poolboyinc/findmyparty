using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FindMyParty.Api.Bookings;

public class BookingConfig : IEntityTypeConfiguration<Booking>
{
    public void Configure(EntityTypeBuilder<Booking> b)
    {
        b.HasKey(x => x.Id);
        b.Property(x => x.Status).HasConversion<int>().IsRequired();
        b.Property(x => x.TotalPrice).HasPrecision(18, 2);
        b.Property(x => x.IdempotencyKey).HasMaxLength(100).IsRequired();
        b.HasIndex(x => new { x.UserId, x.IdempotencyKey }).IsUnique();
        b.HasIndex(x => x.PartyId);
        b.Property(x => x.PassSecret).HasMaxLength(64).IsRequired();
        b.ToTable(t => t.HasCheckConstraint("CK_Bookings_CheckedIn", "\"CheckedInCount\" >= 0 AND \"CheckedInCount\" <= \"TicketCount\""));
    }
}
