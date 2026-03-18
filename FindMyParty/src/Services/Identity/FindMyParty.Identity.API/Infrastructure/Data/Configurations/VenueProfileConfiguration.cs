using FindMyParty.Identity.API.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FindMyParty.Identity.API.Infrastructure.Data.Configurations
{
    public class VenueProfileConfiguration : IEntityTypeConfiguration<VenueProfile>
    {
        public void Configure(EntityTypeBuilder<VenueProfile> builder)
        {
            builder.HasKey(v => v.Id);

            builder.Property(v => v.VenueName)
                .HasMaxLength(200)
                .IsRequired();

            builder.Property(v => v.Address)
                .HasMaxLength(500)
                .IsRequired();

            builder.Property(v => v.Latitude).IsRequired();
            builder.Property(v => v.Longitude).IsRequired();

            builder.HasOne(v => v.User)
                .WithOne()
                .HasForeignKey<VenueProfile>(v => v.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // One venue profile per host
            builder.HasIndex(v => v.UserId).IsUnique();
        }
    }
}
