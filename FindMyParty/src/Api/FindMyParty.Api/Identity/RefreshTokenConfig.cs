using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FindMyParty.Api.Identity;

public class RefreshTokenConfig : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> t)
    {
        t.HasKey(x => x.Id);
        t.Property(x => x.TokenHash).HasMaxLength(64).IsRequired();
        t.HasIndex(x => x.TokenHash).IsUnique();
        t.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
