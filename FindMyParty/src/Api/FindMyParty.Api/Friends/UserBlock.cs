using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FindMyParty.Api.Friends;

/// <summary>`BlockerId` never wants to deal with `BlockedId` again. Works both ways: neither finds nor asks the other.</summary>
public class UserBlock
{
    public Guid BlockerId { get; set; }
    public Guid BlockedId { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class UserBlockConfig : IEntityTypeConfiguration<UserBlock>
{
    public void Configure(EntityTypeBuilder<UserBlock> b)
    {
        b.HasKey(x => new { x.BlockerId, x.BlockedId });
        b.HasIndex(x => x.BlockedId);
    }
}
