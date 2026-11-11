using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FindMyParty.Api.Parties;

public class PartyActConfig : IEntityTypeConfiguration<PartyAct>
{
    public void Configure(EntityTypeBuilder<PartyAct> a)
    {
        a.ToTable("PartyActs");
        a.HasKey(x => x.Id);
        a.Property(x => x.Name).HasMaxLength(100).IsRequired();
        a.Property(x => x.Role).HasMaxLength(100);
        a.HasIndex(x => x.PartyId);
        a.HasOne<Party>().WithMany().HasForeignKey(x => x.PartyId).OnDelete(DeleteBehavior.Cascade);
    }
}
