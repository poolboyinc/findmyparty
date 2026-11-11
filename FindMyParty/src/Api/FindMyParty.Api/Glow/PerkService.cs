using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using FindMyParty.Api.Cities;
using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Glow;

/// <summary>Level perks venues switch on, sponsored perks the admin makes, and the claims guests spend Glow on.</summary>
public partial class PerkService(AppDbContext db, IVenueAccess access)
{
    private DbSet<VenuePerk> VenuePerks => db.Set<VenuePerk>();
    private DbSet<SponsoredPerk> Sponsored => db.Set<SponsoredPerk>();
    private DbSet<PerkClaim> Claims => db.Set<PerkClaim>();

    private record Viewer(int Level, int Balance);

    private async Task<Viewer> ViewerAsync(Guid userId, CancellationToken ct)
    {
        var id = userId.ToString();
        var user = await db.Users.Where(u => u.Id == id).Select(u => new { u.GlowLifetime, u.GlowBalance }).FirstOrDefaultAsync(ct)
                   ?? throw ApiException.NotFound("Account");
        return new Viewer(GlowLevels.For(user.GlowLifetime).Number, user.GlowBalance);
    }

    public static string CityOrThrow(string? city)
    {
        if (string.IsNullOrWhiteSpace(city)) return City.Default;
        var slug = city.Trim().ToLowerInvariant();
        return City.All.Any(c => c.Slug == slug)
            ? slug
            : throw ApiException.Invalid("That city is not on FindMyParty yet.", "city_unknown");
    }

    // ── the guest's list ──

    /// <summary>The perks in a city as the guest sees them: held, then sponsored, then locked.</summary>
    public async Task<List<PerkItem>> ListAsync(Guid userId, string? city, DateTime now, CancellationToken ct)
    {
        var slug = CityOrThrow(city);
        var viewer = await ViewerAsync(userId, ct);

        var offered = await (
            from p in VenuePerks
            where p.Enabled
            join v in db.VenueProfiles on p.VenueId equals v.Id
            where v.CitySlug == slug
            orderby p.UpdatedAt, v.VenueName
            select new { p.Kind, p.UntilLocalTime, v.Id, v.VenueName }).AsNoTracking().ToListAsync(ct);

        var held = new List<PerkItem>();
        var locked = new List<PerkItem>();
        foreach (var kind in PerkKinds.Level)
        {
            var venues = offered.Where(o => o.Kind == kind).ToList();
            if (venues.Count == 0) continue;
            var minLevel = PerkKinds.MinLevel(kind);
            // Venues may run free entry to different times; the title follows the most common one.
            var until = venues.GroupBy(v => v.UntilLocalTime ?? PerkText.Midnight).OrderByDescending(g => g.Count()).First().Key;
            var has = viewer.Level >= minLevel;
            var item = LevelItem(kind, PerkText.Title(kind, until),
                has ? PerkText.Held(venues.Select(v => v.VenueName), minLevel) : PerkText.Locked(minLevel),
                has ? PerkStates.Held : PerkStates.Locked, venues.Select(v => v.Id).ToList(), venues.Select(v => v.VenueName).ToList());
            (has ? held : locked).Add(item);
        }

        var perks = await (
            from p in Sponsored
            where p.Active && p.EndsAt > now
            join v in db.VenueProfiles on p.VenueId equals v.Id
            where v.CitySlug == slug
            orderby p.StartsAt, p.Title
            select new { Perk = p, v.VenueName, v.CitySlug }).AsNoTracking().ToListAsync(ct);
        var perkIds = perks.Select(p => p.Perk.Id).ToList();
        var claims = await Claims.Where(c => c.UserId == userId && perkIds.Contains(c.PerkId)).AsNoTracking().ToDictionaryAsync(c => c.PerkId, ct);

        var sponsored = new List<PerkItem>();
        foreach (var row in perks)
        {
            var claim = claims.GetValueOrDefault(row.Perk.Id);
            if (claim is null && row.Perk.Stock == 0) continue; // all gone
            var item = SponsoredItem(row.Perk, row.VenueName, row.CitySlug, viewer, claim, now);
            (item.State == PerkStates.Locked ? locked : sponsored).Add(item);
        }

        return [.. held, .. sponsored, .. locked];
    }

    private static PerkItem LevelItem(string kind, string title, string subtitle, string state, List<Guid> venueIds, List<string> venueNames) =>
        new(kind, kind, title, subtitle, state, false, null, null, null, null, null, 0, PerkKinds.MinLevel(kind),
            PerkText.LevelName(PerkKinds.MinLevel(kind)), venueIds, venueNames, null, null);

    private static PerkItem SponsoredItem(SponsoredPerk p, string venueName, string? citySlug, Viewer viewer, PerkClaim? claim, DateTime now)
    {
        var night = CityClock.NightDate(p.StartsAt > now ? p.StartsAt : now, citySlug);
        var tonight = night == CityClock.NightDate(now, citySlug);
        var state = claim is not null ? PerkStates.Claimed
            : viewer.Level < p.MinLevel ? PerkStates.Locked
            : viewer.Balance < p.GlowCost ? PerkStates.Short
            : PerkStates.Claimable;
        var subtitle = state == PerkStates.Locked ? PerkText.Locked(p.MinLevel) : PerkText.Sponsored(tonight, night, venueName, p.GlowCost);
        return new PerkItem(p.Id.ToString(), PerkKinds.Sponsored, p.Title, subtitle, state, true, p.SponsorName, p.LogoText,
            p.ColorTop, p.ColorBottom, p.Ink, p.GlowCost, p.MinLevel, PerkText.LevelName(p.MinLevel), [p.VenueId], [venueName], p.EndsAt,
            claim is null ? null : ClaimDto(claim, p.Title, venueName, now));
    }

    public static PerkClaimDto ClaimDto(PerkClaim c, string title, string venueName, DateTime now) =>
        new(c.Id, c.PerkId, title, venueName, QrText(c), Status(c, now), c.ClaimedAt, c.ExpiresAt, c.RedeemedAt);

    private static string Status(PerkClaim c, DateTime now) =>
        c.Status == ClaimStatus.Claimed && now > c.ExpiresAt ? ClaimStatus.Expired : c.Status;

    /// <summary>A sponsored perk as this guest sees it. One the admin switched off is gone, unless the guest claimed it.</summary>
    public async Task<PerkItem> GetAsync(Guid userId, Guid perkId, DateTime now, CancellationToken ct)
    {
        var row = await (
            from p in Sponsored
            where p.Id == perkId
            join v in db.VenueProfiles on p.VenueId equals v.Id
            select new { Perk = p, v.VenueName, v.CitySlug }).AsNoTracking().FirstOrDefaultAsync(ct)
            ?? throw ApiException.NotFound("Perk");
        var claim = await Claims.AsNoTracking().FirstOrDefaultAsync(c => c.PerkId == perkId && c.UserId == userId, ct);
        if (!row.Perk.Active && claim is null) throw ApiException.NotFound("Perk");
        return SponsoredItem(row.Perk, row.VenueName, row.CitySlug, await ViewerAsync(userId, ct), claim, now);
    }

    // ── claiming and redeeming ──

    public const string ClaimPrefix = "fmpc1";

    public static string QrText(PerkClaim c) => $"{ClaimPrefix}.{c.Id:N}.{c.Code}";

    private const string CodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private static string NewCode() =>
        string.Create(8, 0, (span, _) =>
        {
            for (var i = 0; i < span.Length; i++) span[i] = CodeAlphabet[RandomNumberGenerator.GetInt32(CodeAlphabet.Length)];
        });

    /// <summary>Spends Glow balance on a sponsored perk. Claims are final; the level never drops.</summary>
    public async Task<PerkClaimDto> ClaimAsync(Guid userId, Guid perkId, DateTime now, CancellationToken ct)
    {
        var row = await (
            from p in Sponsored
            where p.Id == perkId
            join v in db.VenueProfiles on p.VenueId equals v.Id
            select new { Perk = p, v.VenueName, v.CitySlug }).AsNoTracking().FirstOrDefaultAsync(ct)
            ?? throw ApiException.NotFound("Perk");
        var perk = row.Perk;
        if (!perk.Active || now < perk.StartsAt || now >= perk.EndsAt)
            throw ApiException.Conflict("This is not on right now.", "perk_not_live");
        if (await Claims.AnyAsync(c => c.PerkId == perkId && c.UserId == userId, ct))
            throw ApiException.Conflict("You already claimed this.", "perk_claimed");
        var viewer = await ViewerAsync(userId, ct);
        if (viewer.Level < perk.MinLevel) throw ApiException.Conflict("Your level is not high enough yet.", "perk_level");
        if (perk.Stock == 0) throw Gone();
        if (viewer.Balance < perk.GlowCost) throw NotEnoughGlow();

        var claim = new PerkClaim
        {
            Id = Guid.NewGuid(), PerkId = perkId, UserId = userId, Code = NewCode(), Status = ClaimStatus.Claimed,
            ClaimedAt = now, ExpiresAt = perk.EndsAt
        };
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        // Both re-checked by the database, so two claims at once cannot overspend or take the last one twice.
        var id = userId.ToString();
        var cost = perk.GlowCost;
        if (await db.Users.Where(u => u.Id == id && u.GlowBalance >= cost)
                .ExecuteUpdateAsync(s => s.SetProperty(u => u.GlowBalance, u => u.GlowBalance - cost), ct) == 0)
            throw NotEnoughGlow();
        if (perk.Stock is not null && await Sponsored.Where(p => p.Id == perkId && p.Stock > 0)
                .ExecuteUpdateAsync(s => s.SetProperty(p => p.Stock, p => p.Stock - 1), ct) == 0)
            throw Gone();

        Claims.Add(claim);
        db.Set<GlowEntry>().Add(new GlowEntry
        {
            Id = Guid.NewGuid(), UserId = userId, Kind = GlowKinds.Claim, Points = -cost, ClaimId = claim.Id, VenueId = perk.VenueId,
            At = now, NightDate = CityClock.NightDate(now, row.CitySlug)
        });
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            throw ApiException.Conflict("You already claimed this.", "perk_claimed");
        }
        await tx.CommitAsync(ct);
        return ClaimDto(claim, perk.Title, row.VenueName, now);
    }

    private static ApiException Gone() => ApiException.Conflict("All of these have been claimed.", "perk_gone");
    private static ApiException NotEnoughGlow() => ApiException.Conflict("Not enough Glow to spend.", "perk_glow");

    [GeneratedRegex("^fmpc1\\.([0-9a-fA-F]{32})\\.([A-Za-z0-9]{8})$")]
    private static partial Regex ClaimQr();

    /// <summary>The door redeems a claim code. Only the perk's venue (its host or door) may, and only once.</summary>
    public async Task<RedeemResult> RedeemAsync(Guid scannerId, string? code, DateTime now, CancellationToken ct)
    {
        var match = ClaimQr().Match(code?.Trim() ?? "");
        if (!match.Success) throw InvalidCode();
        var claimId = Guid.ParseExact(match.Groups[1].Value, "N");
        var given = match.Groups[2].Value.ToUpperInvariant();

        var row = await (
            from c in Claims
            where c.Id == claimId
            join p in Sponsored on c.PerkId equals p.Id
            select new { Claim = c, p.Title, p.VenueId }).AsNoTracking().FirstOrDefaultAsync(ct);
        if (row is null || !CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(row.Claim.Code), Encoding.ASCII.GetBytes(given)))
            throw InvalidCode();
        if (await access.DoorNameAsync(scannerId, row.VenueId, ct) is null)
            throw ApiException.Forbidden("This perk is for another venue.");
        if (row.Claim.Status == ClaimStatus.Redeemed) throw Used(row.Claim.RedeemedAt);
        if (now > row.Claim.ExpiresAt) throw ApiException.Conflict("This claim has expired.", "claim_expired");

        var updated = await Claims.Where(c => c.Id == claimId && c.Status == ClaimStatus.Claimed)
            .ExecuteUpdateAsync(s => s
                .SetProperty(c => c.Status, ClaimStatus.Redeemed)
                .SetProperty(c => c.RedeemedAt, now)
                .SetProperty(c => c.RedeemedByUserId, scannerId), ct);
        if (updated == 0)
            throw Used(await Claims.Where(c => c.Id == claimId).Select(c => c.RedeemedAt).FirstOrDefaultAsync(ct));

        var guestId = row.Claim.UserId.ToString();
        var guest = await db.Users.Where(u => u.Id == guestId).Select(u => new { u.DisplayName, u.UserName }).FirstOrDefaultAsync(ct);
        return new RedeemResult(claimId, row.Title, PersonName.Short(PersonName.Display(guest?.DisplayName, guest?.UserName)), now);
    }

    private static ApiException InvalidCode() => ApiException.Invalid("This is not a FindMyParty perk code.", "invalid_code");

    private static ApiException Used(DateTime? redeemedAt) =>
        ApiException.Conflict("This was already redeemed.", "claim_used").With("redeemedAt", redeemedAt);

    // ── on a venue page ──

    /// <summary>The perks the viewer holds at this venue: level perks it offers, and sponsored perks they claimed there.</summary>
    public async Task<List<VenuePerkDto>> HeldAtVenueAsync(Guid userId, Guid venueId, DateTime now, CancellationToken ct)
    {
        var id = userId.ToString();
        var lifetime = await db.Users.Where(u => u.Id == id).Select(u => (int?)u.GlowLifetime).FirstOrDefaultAsync(ct);
        if (lifetime is null) return [];
        var level = GlowLevels.For(lifetime.Value).Number;

        var offered = await VenuePerks.Where(p => p.VenueId == venueId && p.Enabled).AsNoTracking().ToListAsync(ct);
        var result = PerkKinds.Level
            .Select(kind => offered.FirstOrDefault(p => p.Kind == kind))
            .Where(p => p is not null && level >= PerkKinds.MinLevel(p.Kind))
            .Select(p => new VenuePerkDto(p!.Kind, p.Kind, PerkText.Title(p.Kind, p.UntilLocalTime), PerkText.YouHaveIt(PerkKinds.MinLevel(p.Kind)), false, null))
            .ToList();

        var claimed = await (
            from c in Claims
            where c.UserId == userId && c.Status == ClaimStatus.Claimed && c.ExpiresAt > now
            join p in Sponsored on c.PerkId equals p.Id
            where p.VenueId == venueId
            orderby c.ClaimedAt
            select new { p.Id, p.Title }).AsNoTracking().ToListAsync(ct);
        result.AddRange(claimed.Select(c => new VenuePerkDto(c.Id.ToString(), PerkKinds.Sponsored, c.Title, PerkText.ClaimedShowCode, true, c.Id.ToString())));
        return result;
    }

    // ── the host's switches ──

    private async Task<Guid> HostVenueAsync(Guid hostId, CancellationToken ct)
    {
        var id = hostId.ToString();
        return await db.VenueProfiles.Where(v => v.UserId == id).Select(v => (Guid?)v.Id).FirstOrDefaultAsync(ct)
               ?? throw ApiException.NotFound("Venue");
    }

    public async Task<List<HostPerk>> HostPerksAsync(Guid hostId, CancellationToken ct)
    {
        var venueId = await HostVenueAsync(hostId, ct);
        var rows = await VenuePerks.Where(p => p.VenueId == venueId).AsNoTracking().ToListAsync(ct);
        return PerkKinds.Level.Select(kind =>
        {
            var row = rows.FirstOrDefault(r => r.Kind == kind);
            var until = kind == PerkKinds.FreeEntryBefore ? row?.UntilLocalTime ?? PerkText.Midnight : (TimeOnly?)null;
            return new HostPerk(kind, PerkText.Title(kind, until), PerkText.LevelName(PerkKinds.MinLevel(kind)), row?.Enabled ?? false,
                until?.ToString("HH:mm", CultureInfo.InvariantCulture));
        }).ToList();
    }

    public async Task SetHostPerkAsync(Guid hostId, string kind, SetHostPerkRequest request, DateTime now, CancellationToken ct)
    {
        if (!PerkKinds.IsLevel(kind)) throw ApiException.NotFound("Perk");
        TimeOnly? until = null;
        if (kind == PerkKinds.FreeEntryBefore && !string.IsNullOrWhiteSpace(request.UntilLocalTime))
        {
            if (!TimeOnly.TryParseExact(request.UntilLocalTime.Trim(), "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
                throw ApiException.Invalid("Write the time as HH:mm, for example 00:00.");
            until = parsed;
        }

        var venueId = await HostVenueAsync(hostId, ct);
        var row = await VenuePerks.FirstOrDefaultAsync(p => p.VenueId == venueId && p.Kind == kind, ct);
        if (row is null)
        {
            row = new VenuePerk { VenueId = venueId, Kind = kind };
            VenuePerks.Add(row);
        }
        row.Enabled = request.Enabled;
        if (kind == PerkKinds.FreeEntryBefore) row.UntilLocalTime = until ?? row.UntilLocalTime ?? PerkText.Midnight;
        row.UpdatedAt = now;
        await db.SaveChangesAsync(ct);
    }

    // ── the platform admin's sponsored perks ──

    [GeneratedRegex("^#[0-9a-fA-F]{6}$")]
    private static partial Regex HexColour();

    public async Task<PerkItem> CreateSponsoredAsync(Guid adminId, SponsoredPerkInput input, DateTime now, CancellationToken ct)
    {
        static string Text(string? value, int max, string what) =>
            value?.Trim() is { Length: > 0 } t && t.Length <= max ? t : throw ApiException.Invalid($"{what} is 1 to {max} characters.");
        static string Colour(string? value, string what) =>
            value is not null && HexColour().IsMatch(value) ? value.ToLowerInvariant() : throw ApiException.Invalid($"{what} is a colour like #ffd23c.");

        var perk = new SponsoredPerk
        {
            Id = Guid.NewGuid(),
            Title = Text(input.Title, 80, "The title"),
            SponsorName = Text(input.SponsorName, 40, "The sponsor's name"),
            LogoText = Text(input.LogoText, 8, "The logo text"),
            ColorTop = Colour(input.ColorTop, "colorTop"),
            ColorBottom = Colour(input.ColorBottom, "colorBottom"),
            Ink = Colour(input.Ink, "ink"),
            VenueId = input.VenueId,
            MinLevel = input.MinLevel is >= 1 and <= 5 ? input.MinLevel : throw ApiException.Invalid("minLevel is 1 to 5."),
            GlowCost = input.GlowCost is >= 0 and <= 100_000 ? input.GlowCost : throw ApiException.Invalid("glowCost is 0 to 100,000."),
            Stock = input.Stock is null or (>= 0 and <= 100_000) ? input.Stock : throw ApiException.Invalid("stock is empty or 0 to 100,000."),
            StartsAt = DateTime.SpecifyKind(input.StartsAt.ToUniversalTime(), DateTimeKind.Utc),
            EndsAt = DateTime.SpecifyKind(input.EndsAt.ToUniversalTime(), DateTimeKind.Utc),
            CreatedByUserId = adminId,
            Active = true
        };
        if (perk.EndsAt <= perk.StartsAt) throw ApiException.Invalid("A perk must end after it starts.");
        var venue = await db.VenueProfiles.Where(v => v.Id == perk.VenueId).Select(v => new { v.VenueName, v.CitySlug }).FirstOrDefaultAsync(ct)
                    ?? throw ApiException.Invalid("No venue with that id.");

        Sponsored.Add(perk);
        await db.SaveChangesAsync(ct);
        return SponsoredItem(perk, venue.VenueName, venue.CitySlug, await ViewerAsync(adminId, ct), null, now);
    }

    public async Task<List<PerkItem>> AdminListAsync(Guid adminId, DateTime now, CancellationToken ct)
    {
        var viewer = await ViewerAsync(adminId, ct);
        var rows = await (
            from p in Sponsored
            where p.Active
            join v in db.VenueProfiles on p.VenueId equals v.Id
            orderby p.EndsAt descending, p.Title
            select new { Perk = p, v.VenueName, v.CitySlug }).AsNoTracking().ToListAsync(ct);
        return rows.Select(r => SponsoredItem(r.Perk, r.VenueName, r.CitySlug, viewer, null, now)).ToList();
    }

    /// <summary>Switches a sponsored perk off. Claims already made stay valid until they expire.</summary>
    public async Task SwitchOffAsync(Guid perkId, CancellationToken ct)
    {
        if (await Sponsored.Where(p => p.Id == perkId).ExecuteUpdateAsync(s => s.SetProperty(p => p.Active, false), ct) == 0)
            throw ApiException.NotFound("Perk");
    }
}
