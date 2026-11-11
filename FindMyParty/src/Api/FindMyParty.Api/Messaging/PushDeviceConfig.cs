using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FindMyParty.Api.Messaging;

public class PushDeviceConfig : IEntityTypeConfiguration<PushDevice>
{
    public void Configure(EntityTypeBuilder<PushDevice> d)
    {
        d.ToTable("PushDevices");
        d.HasKey(x => x.Id);
        d.Property(x => x.ExpoToken).HasMaxLength(200).IsRequired();
        d.Property(x => x.Platform).HasMaxLength(10).IsRequired();
        d.HasIndex(x => x.ExpoToken).IsUnique();
        d.HasIndex(x => x.UserId);
    }
}
