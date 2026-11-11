using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using FindMyParty.Api.Parties;
using FindMyParty.Api.Venues;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Glow;

/// <summary>Glow: points at the scan, levels, streak, badges, perks and claims, the night recap, referral.</summary>
public class GlowFeature : IFeature
{
    public void Add(IServiceCollection services, IConfiguration config)
    {
        services.AddScoped<GlowService>();
        services.AddScoped<IGuestPassIds, ModelGuestPassIds>();
        services.AddScoped<PerkService>();
        services.AddScoped<RecapService>();
        services.AddScoped<PerkPricer>();
        services.AddScoped<IBookingPricer>(sp => sp.GetRequiredService<PerkPricer>());
        services.AddScoped<ICheckInListener, GlowAwarder>();
        services.AddScoped<IVenueDetailEnricher, VenuePerksEnricher>();
        services.AddScoped<IPartyDetailEnricher, PartyPerkEnricher>();
        services.AddScoped<IAccountCleanup, GlowCleanup>();
        services.AddSingleton<RecapPusher>();
        services.AddHostedService(sp => sp.GetRequiredService<RecapPusher>());
    }
}

/// <summary>Pays Glow when the door lets a guest in, and tells them (push `scanned`).</summary>
public class GlowAwarder(GlowService glow) : ICheckInListener
{
    public Task OnCheckedInAsync(CheckInEvent e, CancellationToken ct) => glow.AwardAsync(e, push: true, ct);
}

/// <summary>`perks` on a venue page: what the signed-in viewer holds there.</summary>
public class VenuePerksEnricher(PerkService perks, TimeProvider time) : IVenueDetailEnricher
{
    public async Task EnrichAsync(VenueResponse venue, Guid? viewerId, CancellationToken ct)
    {
        if (viewerId is not { } viewer) return;
        venue.Extra["perks"] = await perks.HeldAtVenueAsync(viewer, venue.Id, time.GetUtcNow().UtcDateTime, ct);
    }
}

/// <summary>
/// `perk` on a party page: the priced perk the signed-in viewer would get booking now. One guest first ("Free for you
/// before midnight"); when only the free +1 applies, as for two ("Your +1 is free").
/// </summary>
public class PartyPerkEnricher(PerkPricer pricer, TimeProvider time) : IPartyDetailEnricher
{
    public async Task EnrichAsync(PartyDetailResponse party, Guid? viewerId, CancellationToken ct)
    {
        var now = time.GetUtcNow().UtcDateTime;
        if (viewerId is not { } viewer || party.VenueId is null || party.EndsAt <= now) return;
        var (best, _) = await pricer.BestAsync(viewer, party.Id, 1, now, ct);
        best ??= (await pricer.BestAsync(viewer, party.Id, 2, now, ct)).Best;
        if (best is not null) party.Extra["perk"] = new PartyPerk(best.Kind, best.Kind, PerkText.PartyTitle(best.Kind, best.Until));
    }
}

/// <summary>A deleted account takes its Glow, claims, recap links and recap marks with it.</summary>
public class GlowCleanup(AppDbContext db) : IAccountCleanup
{
    public async Task DeleteAsync(Guid userId, CancellationToken ct)
    {
        await db.Set<GlowEntry>().Where(x => x.UserId == userId).ExecuteDeleteAsync(ct);
        await db.Set<PerkClaim>().Where(x => x.UserId == userId).ExecuteDeleteAsync(ct);
        await db.Set<RecapShare>().Where(x => x.UserId == userId).ExecuteDeleteAsync(ct);
        await db.Set<RecapNotice>().Where(x => x.UserId == userId).ExecuteDeleteAsync(ct);
        // Those they invited no longer point at an account that is gone.
        var id = userId.ToString();
        await db.Users.Where(u => u.ReferredByUserId == id).ExecuteUpdateAsync(s => s.SetProperty(u => u.ReferredByUserId, (string?)null), ct);
    }
}
