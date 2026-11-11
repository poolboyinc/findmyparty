using FindMyParty.Api.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FindMyParty.Api.Bookings;

public class CheckInConfig : IEntityTypeConfiguration<CheckIn>
{
    public void Configure(EntityTypeBuilder<CheckIn> c)
    {
        c.HasKey(x => x.Id);
        c.HasIndex(x => new { x.PartyId, x.At });
        c.HasIndex(x => x.BookingId);
        c.HasIndex(x => x.GuestUserId);
        c.HasIndex(x => x.ByUserId);
        c.Property(x => x.DoorName).HasMaxLength(40).IsRequired().HasDefaultValue(HostOnlyVenueAccess.HostDoorName);
        c.Property(x => x.AmountDue).HasPrecision(18, 2).HasDefaultValue(0m);
        c.HasIndex(x => x.ClientScanId).IsUnique();
    }
}
