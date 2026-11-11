using FindMyParty.Api.Cities;
using FindMyParty.Api.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FindMyParty.Api.Venues;

public class VenueProfileConfig : IEntityTypeConfiguration<VenueProfile>
{
    public void Configure(EntityTypeBuilder<VenueProfile> v)
    {
        v.HasKey(x => x.Id);
        v.Property(x => x.VenueName).HasMaxLength(200).IsRequired();
        v.Property(x => x.Address).HasMaxLength(500).IsRequired();
        v.Property(x => x.WorkingDays).HasMaxLength(50);
        v.HasOne(x => x.User).WithOne().HasForeignKey<VenueProfile>(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        v.HasIndex(x => x.UserId).IsUnique(); // one venue per host

        v.Property(x => x.CitySlug).HasMaxLength(40).IsRequired().HasDefaultValue(City.Default);
        v.Property(x => x.Kind).HasMaxLength(40);
        v.Property(x => x.Area).HasMaxLength(80);
        v.Property(x => x.ImageUrl).HasMaxLength(2000);
        v.Property(x => x.Footprint).HasColumnType("jsonb");
        v.HasIndex(x => x.CitySlug);
    }
}
