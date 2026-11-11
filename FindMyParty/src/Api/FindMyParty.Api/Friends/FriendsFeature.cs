using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Friends;

public class FriendsFeature : IFeature
{
    public void Add(IServiceCollection services, IConfiguration config)
    {
        services.AddScoped<People>();
        services.AddScoped<FriendService>();
        services.AddScoped<PresenceService>();
        services.AddScoped<ReportService>();
        services.AddScoped<FriendsHereEnricher>();
        services.AddScoped<IPartyEnricher>(sp => sp.GetRequiredService<FriendsHereEnricher>());
        services.AddScoped<IPartyDetailEnricher>(sp => sp.GetRequiredService<FriendsHereEnricher>());
        services.AddScoped<IVenueEnricher>(sp => sp.GetRequiredService<FriendsHereEnricher>());
        services.AddScoped<IVenueDetailEnricher>(sp => sp.GetRequiredService<FriendsHereEnricher>());
        services.AddScoped<IAccountCleanup, FriendsCleanup>();
    }
}

/// <summary>A deleted account leaves no edges: friendships, blocks, reports by or about it, and its request log.</summary>
public class FriendsCleanup(AppDbContext db) : IAccountCleanup
{
    public async Task DeleteAsync(Guid userId, CancellationToken ct)
    {
        await db.Set<Friendship>().Where(f => f.UserLowId == userId || f.UserHighId == userId).ExecuteDeleteAsync(ct);
        await db.Set<UserBlock>().Where(b => b.BlockerId == userId || b.BlockedId == userId).ExecuteDeleteAsync(ct);
        await db.Set<UserReport>().Where(r => r.ReporterId == userId || r.ReportedUserId == userId).ExecuteDeleteAsync(ct);
        await db.Set<FriendRequestLog>().Where(l => l.FromUserId == userId || l.ToUserId == userId).ExecuteDeleteAsync(ct);
    }
}
