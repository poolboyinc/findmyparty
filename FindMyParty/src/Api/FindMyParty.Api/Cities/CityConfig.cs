using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FindMyParty.Api.Cities;

public class CityConfig : IEntityTypeConfiguration<City>
{
    public void Configure(EntityTypeBuilder<City> c)
    {
        c.ToTable("Cities");
        c.HasKey(x => x.Slug);
        c.Property(x => x.Slug).HasMaxLength(40);
        c.Property(x => x.Name).HasMaxLength(80).IsRequired();
        c.Property(x => x.TimeZone).HasMaxLength(60).IsRequired();
        c.HasData(City.All);
    }
}
