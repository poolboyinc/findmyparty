using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FindMyParty.Api.Glow;

public class GlowEntryConfig : IEntityTypeConfiguration<GlowEntry>
{
    public void Configure(EntityTypeBuilder<GlowEntry> e)
    {
        e.ToTable("GlowEntries");
        e.HasKey(x => x.Id);
        e.Property(x => x.Kind).HasMaxLength(20).IsRequired();
        e.HasIndex(x => new { x.UserId, x.At });
        // One entry of each kind per booking and user: a scan can never be paid twice.
        e.HasIndex(x => new { x.UserId, x.BookingId, x.Kind }).IsUnique().HasFilter("\"BookingId\" IS NOT NULL");
    }
}

public class VenuePerkConfig : IEntityTypeConfiguration<VenuePerk>
{
    public void Configure(EntityTypeBuilder<VenuePerk> p)
    {
        p.ToTable("VenuePerks");
        p.HasKey(x => new { x.VenueId, x.Kind });
        p.Property(x => x.Kind).HasMaxLength(20);
    }
}

public class SponsoredPerkConfig : IEntityTypeConfiguration<SponsoredPerk>
{
    public void Configure(EntityTypeBuilder<SponsoredPerk> p)
    {
        p.ToTable("SponsoredPerks");
        p.HasKey(x => x.Id);
        p.Property(x => x.Title).HasMaxLength(80).IsRequired();
        p.Property(x => x.SponsorName).HasMaxLength(40).IsRequired();
        p.Property(x => x.LogoText).HasMaxLength(8).IsRequired();
        p.Property(x => x.ColorTop).HasMaxLength(7).IsRequired();
        p.Property(x => x.ColorBottom).HasMaxLength(7).IsRequired();
        p.Property(x => x.Ink).HasMaxLength(7).IsRequired();
        p.HasIndex(x => new { x.VenueId, x.EndsAt });
        p.ToTable(t => t.HasCheckConstraint("CK_SponsoredPerks_Stock", "\"Stock\" IS NULL OR \"Stock\" >= 0"));
    }
}

public class PerkClaimConfig : IEntityTypeConfiguration<PerkClaim>
{
    public void Configure(EntityTypeBuilder<PerkClaim> c)
    {
        c.ToTable("PerkClaims");
        c.HasKey(x => x.Id);
        c.Property(x => x.Code).HasMaxLength(8).IsRequired();
        c.Property(x => x.Status).HasMaxLength(10).IsRequired();
        c.HasIndex(x => new { x.PerkId, x.UserId }).IsUnique();
        c.HasIndex(x => x.UserId);
    }
}

public class RecapShareConfig : IEntityTypeConfiguration<RecapShare>
{
    public void Configure(EntityTypeBuilder<RecapShare> s)
    {
        s.ToTable("RecapShares");
        s.HasKey(x => x.Token);
        s.Property(x => x.Token).HasMaxLength(16);
        s.HasIndex(x => new { x.UserId, x.NightDate }).IsUnique();
    }
}

public class RecapNoticeConfig : IEntityTypeConfiguration<RecapNotice>
{
    public void Configure(EntityTypeBuilder<RecapNotice> n)
    {
        n.ToTable("RecapNotices");
        n.HasKey(x => new { x.UserId, x.NightDate });
    }
}
