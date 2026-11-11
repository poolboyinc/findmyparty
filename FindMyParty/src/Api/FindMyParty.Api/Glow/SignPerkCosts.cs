using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using FindMyParty.Api.Signs;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Glow;

/// <summary>What a sponsored perk costs in Glow, for the sign card on the map ("Claim for 400 Glow").</summary>
public class GlowSignPerkCosts(AppDbContext db) : ISignPerkCosts
{
    public async Task<IReadOnlyDictionary<Guid, int>> CostsAsync(IReadOnlyCollection<Guid> perkIds, CancellationToken ct)
    {
        if (perkIds.Count == 0) return new Dictionary<Guid, int>();
        return await db.Set<SponsoredPerk>()
            .Where(p => perkIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, p => p.GlowCost, ct);
    }
}

/// <summary>Registers the sign card's perk costs. Runs before the signs feature, whose default only fills a gap.</summary>
public class SignPerkCostsFeature : IFeature
{
    public void Add(IServiceCollection services, IConfiguration config) =>
        services.AddScoped<ISignPerkCosts, GlowSignPerkCosts>();
}
