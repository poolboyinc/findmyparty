using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FindMyParty.Api.Me;

public class SavedItemConfig : IEntityTypeConfiguration<SavedItem>
{
    public void Configure(EntityTypeBuilder<SavedItem> s)
    {
        s.ToTable("SavedItems");
        s.HasKey(x => new { x.UserId, x.Kind, x.TargetId });
        s.Property(x => x.Kind).HasMaxLength(10);
    }
}
