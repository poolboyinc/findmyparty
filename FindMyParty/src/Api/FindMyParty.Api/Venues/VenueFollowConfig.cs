using FindMyParty.Api.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FindMyParty.Api.Venues;

public class VenueFollowConfig : IEntityTypeConfiguration<VenueFollow>
{
    public void Configure(EntityTypeBuilder<VenueFollow> f)
    {
        f.ToTable("VenueFollows");
        f.HasKey(x => new { x.UserId, x.VenueId });
        f.HasIndex(x => x.VenueId);
        // A venue that goes (its host deleted their account) takes its follows with it.
        f.HasOne<VenueProfile>().WithMany().HasForeignKey(x => x.VenueId).OnDelete(DeleteBehavior.Cascade);
    }
}
