using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FindMyParty.Api.Friends;

public class FriendshipConfig : IEntityTypeConfiguration<Friendship>
{
    public void Configure(EntityTypeBuilder<Friendship> f)
    {
        f.HasKey(x => x.Id);
        f.Property(x => x.Status).HasMaxLength(10).IsRequired();
        f.HasIndex(x => new { x.UserLowId, x.UserHighId }).IsUnique();
        f.HasIndex(x => x.UserHighId); // the other half of "every edge of this user"
    }
}
