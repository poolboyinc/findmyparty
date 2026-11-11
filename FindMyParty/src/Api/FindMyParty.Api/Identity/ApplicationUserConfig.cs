using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FindMyParty.Api.Identity;

public class ApplicationUserConfig : IEntityTypeConfiguration<ApplicationUser>
{
    public void Configure(EntityTypeBuilder<ApplicationUser> u)
    {
        u.Property(x => x.DisplayName).HasMaxLength(40);
        u.Property(x => x.CreatedAt).HasDefaultValueSql("now()");
        u.Property(x => x.HomeCity).HasMaxLength(40);
        u.Property(x => x.Taste).HasMaxLength(200);
        u.Property(x => x.GlowLifetime).HasDefaultValue(0);
        u.Property(x => x.GlowBalance).HasDefaultValue(0);
        u.Property(x => x.ShareWithFriends).HasDefaultValue(false);
        u.Property(x => x.SharingSuspended).HasDefaultValue(false);
        u.Property(x => x.NotifyVenues).HasDefaultValue(true);
        u.Property(x => x.NotifyFriends).HasDefaultValue(true);
        u.Property(x => x.NotifyNights).HasDefaultValue(true);
    }
}
