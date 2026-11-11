using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using FindMyParty.Api.Parties;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Glow;

/// <summary>A priced level perk a guest would get on a booking, with what the sentences need.</summary>
public record PricedPerk(string Kind, decimal Discount, TimeOnly? Until, DateTime? ValidUntil);

/// <summary>
/// The level perks on a booking (spec §2.3 "Perks"): among the priced ones the guest holds at the party's venue, the larger
/// discount wins, a tie goes to free entry. Skip the line rides along on its own.
/// </summary>
public class PerkPricer(AppDbContext db) : IBookingPricer
{
    public async Task<PerkQuote?> QuoteAsync(Guid userId, Guid partyId, int ticketCount, DateTime nowUtc, CancellationToken ct)
    {
        var (best, skipLine) = await BestAsync(userId, partyId, ticketCount, nowUtc, ct);
        if (best is null && !skipLine) return null;
        return best is null
            ? new PerkQuote(null, null, 0, 0, null, skipLine)
            : new PerkQuote(best.Kind, PerkText.QuoteTitle(best.Kind, best.Until), 1, best.Discount, best.ValidUntil, skipLine);
    }

    public async Task<(PricedPerk? Best, bool SkipLine)> BestAsync(Guid userId, Guid partyId, int ticketCount, DateTime now, CancellationToken ct)
    {
        var party = await (
            from p in db.Parties
            where p.Id == partyId && !p.IsDeleted
            join v in db.VenueProfiles on p.VenueId equals (Guid?)v.Id
            select new { p.Price, p.StartsAt, p.EndsAt, p.Status, VenueId = v.Id, v.CitySlug }).AsNoTracking().FirstOrDefaultAsync(ct);
        if (party is null || party.Status != PartyStatus.Published) return (null, false);

        var id = userId.ToString();
        var lifetime = await db.Users.Where(u => u.Id == id).Select(u => (int?)u.GlowLifetime).FirstOrDefaultAsync(ct);
        if (lifetime is null) return (null, false);
        var level = GlowLevels.For(lifetime.Value).Number;

        var offered = await db.Set<VenuePerk>().Where(p => p.VenueId == party.VenueId && p.Enabled).AsNoTracking().ToListAsync(ct);
        var held = offered.Where(p => level >= PerkKinds.MinLevel(p.Kind)).ToList();

        var candidates = new List<PricedPerk>();
        if (held.FirstOrDefault(p => p.Kind == PerkKinds.FreeEntryBefore) is { } free && party.Price > 0)
        {
            var until = UntilUtc(party.StartsAt, party.CitySlug, free.UntilLocalTime);
            if (now < until) candidates.Add(new PricedPerk(PerkKinds.FreeEntryBefore, party.Price, free.UntilLocalTime ?? PerkText.Midnight, until));
        }
        if (held.Any(p => p.Kind == PerkKinds.PlusOneFree) && ticketCount >= 2 && party.Price > 0)
            candidates.Add(new PricedPerk(PerkKinds.PlusOneFree, party.Price, null, null));

        var best = candidates
            .OrderByDescending(c => c.Discount)
            .ThenBy(c => c.Kind == PerkKinds.FreeEntryBefore ? 0 : 1)
            .FirstOrDefault();
        return (best, held.Any(p => p.Kind == PerkKinds.SkipLine));
    }

    /// <summary>
    /// The moment free entry ends for a party: the until-time on the party's night, in the venue's city.
    /// Times before 06:00 (midnight, 01:00) fall on the calendar day after the night's date.
    /// </summary>
    public static DateTime UntilUtc(DateTime partyStartsAt, string? citySlug, TimeOnly? untilLocal)
    {
        var until = untilLocal ?? PerkText.Midnight;
        var night = CityClock.NightDate(partyStartsAt, citySlug);
        var day = until.Hour < CityClock.NightEndsAtHour ? night.AddDays(1) : night;
        return CityClock.Utc(day.ToDateTime(until), citySlug);
    }
}
