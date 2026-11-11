using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using FindMyParty.Api.Parties;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace FindMyParty.Api.Signs;

public class SignsFeature : IFeature
{
    public void Add(IServiceCollection services, IConfiguration config)
    {
        services.AddSingleton<SignSettings>();
        services.AddScoped<SignService>();
        services.TryAddScoped<ISignPerkCosts, NoSignPerkCosts>(); // Glow brings the real one
        services.AddScoped<SponsoredEnricher>();
        services.AddScoped<IPartyEnricher>(sp => sp.GetRequiredService<SponsoredEnricher>());
        services.AddScoped<IPartyDetailEnricher>(sp => sp.GetRequiredService<SponsoredEnricher>());
        services.AddScoped<IAccountCleanup, SignsCleanup>();
    }
}

/// <summary>`sponsored: true` on a party an approved sign promotes today. Left out otherwise.</summary>
public class SponsoredEnricher(SignService signs) : IPartyEnricher, IPartyDetailEnricher
{
    public const string Key = "sponsored";

    public async Task EnrichAsync(IReadOnlyList<PartyResponse> parties, Guid? viewerId, CancellationToken ct)
    {
        var sponsored = await signs.SponsoredAsync(parties.Select(p => p.Id).ToList(), ct);
        foreach (var party in parties.Where(p => sponsored.Contains(p.Id))) party.Extra[Key] = true;
    }

    public async Task EnrichAsync(PartyDetailResponse party, Guid? viewerId, CancellationToken ct)
    {
        if ((await signs.SponsoredAsync([party.Id], ct)).Count > 0) party.Extra[Key] = true;
    }
}

/// <summary>A deleted account's hides go; its signs that are waiting or approved are cancelled.</summary>
public class SignsCleanup(AppDbContext db) : IAccountCleanup
{
    public async Task DeleteAsync(Guid userId, CancellationToken ct)
    {
        await db.Set<SignHide>().Where(h => h.UserId == userId).ExecuteDeleteAsync(ct);
        await db.Set<SignBooking>()
            .Where(b => b.BookedByUserId == userId && (b.Status == SignBooking.PendingReview || b.Status == SignBooking.Approved))
            .ExecuteUpdateAsync(s => s.SetProperty(b => b.Status, SignBooking.Cancelled), ct);
    }
}
