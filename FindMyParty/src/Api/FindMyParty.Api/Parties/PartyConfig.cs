using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FindMyParty.Api.Parties;

public class PartyConfig : IEntityTypeConfiguration<Party>
{
    public void Configure(EntityTypeBuilder<Party> p)
    {
        p.HasKey(x => x.Id);
        p.Property(x => x.Title).IsRequired().HasMaxLength(200);
        p.Property(x => x.Description).IsRequired().HasMaxLength(4000);
        p.Property(x => x.Price).HasPrecision(10, 2);
        p.Property(x => x.Genre).HasMaxLength(100);
        p.Property(x => x.PerformerName).HasMaxLength(100);
        p.Property(x => x.PerformerType).HasMaxLength(100);
        p.Property(x => x.HoldMinutes).HasDefaultValue(Party.DefaultHoldMinutes);
        p.HasIndex(x => new { x.Status, x.EndsAt });
        p.HasIndex(x => x.HostId);
        p.HasIndex(x => x.VenueId);
        // Last line of defence: the database itself refuses to oversell.
        p.ToTable(t => t.HasCheckConstraint("CK_Parties_TicketsSold", "\"TicketsSold\" >= 0 AND \"TicketsSold\" <= \"Capacity\""));
    }
}
