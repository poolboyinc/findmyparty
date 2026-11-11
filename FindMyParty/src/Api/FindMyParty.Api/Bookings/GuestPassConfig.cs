using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FindMyParty.Api.Bookings;

public class GuestPassConfig : IEntityTypeConfiguration<GuestPass>
{
    public void Configure(EntityTypeBuilder<GuestPass> g)
    {
        g.ToTable("GuestPasses");
        g.HasKey(x => x.Id);
        g.Property(x => x.Token).HasMaxLength(32).IsRequired();
        g.HasIndex(x => x.Token).IsUnique();
        g.Property(x => x.PassSecret).HasMaxLength(64).IsRequired();
        g.HasIndex(x => x.BookingId);
        g.HasIndex(x => x.ClaimedByUserId);
    }
}
