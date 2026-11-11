using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FindMyParty.Api.Messaging;

public class PasswordResetConfig : IEntityTypeConfiguration<PasswordReset>
{
    public void Configure(EntityTypeBuilder<PasswordReset> r)
    {
        r.ToTable("PasswordResets");
        r.HasKey(x => x.Id);
        r.Property(x => x.TokenHash).HasMaxLength(64).IsRequired();
        r.HasIndex(x => x.TokenHash).IsUnique();
        r.HasIndex(x => x.UserId);
    }
}
