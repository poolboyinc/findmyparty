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
    }
}
