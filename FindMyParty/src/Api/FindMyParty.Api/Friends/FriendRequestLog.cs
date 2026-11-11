using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FindMyParty.Api.Friends;

/// <summary>
/// One friend request sent. Kept after the request itself is withdrawn or declined, so that asking, withdrawing
/// and asking again still counts towards the daily limit, and does not ring the other person's phone every time.
/// </summary>
public class FriendRequestLog
{
    public Guid Id { get; set; }
    public Guid FromUserId { get; set; }
    public Guid ToUserId { get; set; }
    public DateTime At { get; set; }
}

public class FriendRequestLogConfig : IEntityTypeConfiguration<FriendRequestLog>
{
    public void Configure(EntityTypeBuilder<FriendRequestLog> l)
    {
        l.HasKey(x => x.Id);
        l.HasIndex(x => new { x.FromUserId, x.At });
        l.HasIndex(x => x.ToUserId);
    }
}
