using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using FindMyParty.Api.Cities;
using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using FindMyParty.Api.Identity;
using FindMyParty.Api.Parties;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Signs;

/// <summary>
/// The Glow cost of sponsored perks, for a sign's card ("Claim for 400 Glow"). Perks belong to Glow (A5), which
/// registers the real lookup; until then a card carries no cost.
/// </summary>
public interface ISignPerkCosts { Task<IReadOnlyDictionary<Guid, int>> CostsAsync(IReadOnlyCollection<Guid> perkIds, CancellationToken ct); }

public class NoSignPerkCosts : ISignPerkCosts
{
    public Task<IReadOnlyDictionary<Guid, int>> CostsAsync(IReadOnlyCollection<Guid> perkIds, CancellationToken ct) =>
        Task.FromResult<IReadOnlyDictionary<Guid, int>>(new Dictionary<Guid, int>());
}

/// <summary>Booking signs (hosts and the admin), reviewing them, the spots they go on, and what the map shows.</summary>
public class SignService(AppDbContext db, SignSettings settings, ISignPerkCosts perkCosts, INotifier notifier, TimeProvider time)
{
    private DateTime Now => time.GetUtcNow().UtcDateTime;

    private static ApiException SignInvalid(string title = "Up to 24 characters on two lines.") =>
        ApiException.Invalid(title, "sign_invalid");

    // ── spots ──

    public SignSpotDto SpotDto(SignSpot s, bool free) => new(s.Id, s.CitySlug, s.Number, s.Format, s.Label, s.Area, s.Latitude, s.Longitude,
        s.BearingDeg, s.BaseHeightM, s.WidthM, s.HeightM, s.BuildingHeightM, s.VenueId, settings.PriceOf(s), free);

    /// <summary>Which of these (spot, week) pairs are held by a booking waiting for review or approved.</summary>
    private async Task<HashSet<(Guid Spot, DateOnly Monday)>> TakenAsync(IReadOnlyCollection<(Guid Spot, DateOnly Monday)> asked, CancellationToken ct)
    {
        if (asked.Count == 0) return [];
        var spots = asked.Select(a => a.Spot).Distinct().ToList();
        var from = asked.Min(a => a.Monday);
        var held = await db.Set<SignBooking>().AsNoTracking()
            .Where(b => b.SpotId != null && spots.Contains(b.SpotId.Value) && (b.Status == SignBooking.PendingReview || b.Status == SignBooking.Approved) && b.EndsOn >= from)
            .Select(b => new { Spot = b.SpotId!.Value, b.StartsOn, b.EndsOn })
            .ToListAsync(ct);
        return asked.Where(a => held.Any(h => h.Spot == a.Spot && h.StartsOn <= a.Monday.AddDays(6) && h.EndsOn >= a.Monday)).ToHashSet();
    }

    public async Task<List<SignSpotDto>> SpotsAsync(CancellationToken ct)
    {
        var spots = await db.Set<SignSpot>().AsNoTracking().OrderBy(s => s.CitySlug).ThenBy(s => s.Format).ThenBy(s => s.Number).ToListAsync(ct);
        var asked = spots.Select(s => (s.Id, SignRules.Monday(SignRules.Today(Now, s.CitySlug)))).ToList();
        var taken = await TakenAsync(asked, ct);
        return spots.Select((s, i) => SpotDto(s, s.Active && !taken.Contains(asked[i]))).ToList();
    }

    public async Task<SignSpotDto> SaveSpotAsync(Guid? id, SignSpotInput input, CancellationToken ct)
    {
        if (input.City is null || !City.All.Any(c => c.Slug == input.City)) throw ApiException.Invalid("That city is not on FindMyParty yet.", "city_unknown");
        if (input.Format is not (SignSpot.Facade or SignSpot.Hologram)) throw ApiException.Invalid("A spot is a facade or a hologram.");
        if (input.Number < 1) throw ApiException.Invalid("Spot numbers start at 1.");
        if (string.IsNullOrWhiteSpace(input.Label) || input.Label.Trim().Length > 60) throw ApiException.Invalid("A label is 1 to 60 characters.");
        if (string.IsNullOrWhiteSpace(input.Area) || input.Area.Trim().Length > 80) throw ApiException.Invalid("An area is 1 to 80 characters.");
        if (input.Latitude is < -90 or > 90 || input.Longitude is < -180 or > 180) throw ApiException.Invalid("That is not a place on Earth.");
        if (input.WidthM <= 0 || input.HeightM <= 0 || input.BaseHeightM < 0 || input.BuildingHeightM < 0) throw ApiException.Invalid("Sizes are positive metres.");
        if (input.WeeklyPrice is < 0) throw ApiException.Invalid("A price cannot be negative.");
        if (input.VenueId is { } venueId && !await db.VenueProfiles.AnyAsync(v => v.Id == venueId, ct)) throw ApiException.NotFound("Venue");

        var spot = id is null ? new SignSpot { Id = Guid.NewGuid() }
            : await db.Set<SignSpot>().FirstOrDefaultAsync(s => s.Id == id, ct) ?? throw ApiException.NotFound("Spot");
        if (await db.Set<SignSpot>().AnyAsync(s => s.Id != spot.Id && s.CitySlug == input.City && s.Format == input.Format && s.Number == input.Number, ct))
            throw ApiException.Invalid($"There is already a {input.Format} spot {input.Number} in this city.");

        spot.CitySlug = input.City;
        spot.Number = input.Number;
        spot.Format = input.Format;
        spot.Label = input.Label.Trim();
        spot.Area = input.Area.Trim();
        spot.Latitude = input.Latitude;
        spot.Longitude = input.Longitude;
        spot.BearingDeg = ((input.BearingDeg % 360) + 360) % 360;
        spot.BaseHeightM = input.BaseHeightM;
        spot.WidthM = input.WidthM;
        spot.HeightM = input.HeightM;
        spot.BuildingHeightM = input.BuildingHeightM;
        spot.VenueId = input.VenueId;
        spot.WeeklyPrice = input.WeeklyPrice;
        spot.Active = input.Active;
        if (id is null) db.Set<SignSpot>().Add(spot);
        await db.SaveChangesAsync(ct);

        var week = SignRules.Monday(SignRules.Today(Now, spot.CitySlug));
        return SpotDto(spot, spot.Active && (await TakenAsync([(spot.Id, week)], ct)).Count == 0);
    }

    // ── a host's side ──

    private async Task<VenueProfile> VenueOfAsync(Guid host, CancellationToken ct)
    {
        var key = host.ToString();
        return await db.VenueProfiles.AsNoTracking().FirstOrDefaultAsync(v => v.UserId == key, ct) ?? throw ApiException.NotFound("Venue");
    }

    /// <summary>A spot this venue may book: not another venue's own wall.</summary>
    private static bool OfferedTo(SignSpot spot, Guid venueId) => spot.VenueId is null || spot.VenueId == venueId;

    public async Task<SignOptions> OptionsAsync(Guid host, string? weekId, CancellationToken ct)
    {
        var venue = await VenueOfAsync(host, ct);
        var city = venue.CitySlug;
        var now = Now;
        var today = SignRules.Today(now, city);
        var weeks = SignRules.Window(today);
        var week = weekId is null ? weeks[0] : weeks.FirstOrDefault(w => w.Id == weekId) ?? throw ApiException.Invalid("Pick this week or one of the next eight.");

        var spots = (await db.Set<SignSpot>().AsNoTracking().Where(s => s.CitySlug == city && s.Active).OrderBy(s => s.Format).ThenBy(s => s.Number).ToListAsync(ct))
            .Where(s => OfferedTo(s, venue.Id)).ToList();
        var taken = await TakenAsync(spots.Select(s => (s.Id, week.StartsOn)).ToList(), ct);
        var spotDtos = spots.Select(s => SpotDto(s, !taken.Contains((s.Id, week.StartsOn)))).ToList();

        var slotsTonight = await SlotsHeldAsync(city, today, ct);
        SignFormatInfo Weekly(string format)
        {
            var mine = spotDtos.Where(s => s.Format == format).ToList();
            return new SignFormatInfo(format, SignRules.Title(format), settings.Weekly(format), "week", mine.Count, mine.Count(s => s.Free));
        }
        var formats = new List<SignFormatInfo>
        {
            Weekly(SignSpot.Facade),
            Weekly(SignSpot.Hologram),
            new(SignBooking.TonightSlot, SignRules.Title(SignBooking.TonightSlot), settings.TonightSlot, "night",
                settings.TonightSlotsPerNight, Math.Max(0, settings.TonightSlotsPerNight - slotsTonight)),
        };

        var parties = await db.Parties.AsNoTracking()
            .Where(p => p.HostId == host && !p.IsDeleted && p.Status == PartyStatus.Published && p.EndsAt > now)
            .OrderBy(p => p.StartsAt).Take(30)
            .Select(p => new SignParty(p.Id, p.Title, p.StartsAt, p.ImageUrl)).ToListAsync(ct);

        var mine = await db.Set<SignBooking>().AsNoTracking().Where(b => b.BookedByUserId == host)
            .OrderByDescending(b => b.CreatedAt).Take(50).ToListAsync(ct);
        return new SignOptions(week, weeks, formats, spotDtos, parties, await DtosAsync(mine, ct));
    }

    /// <summary>Tonight slots held (waiting or approved) in this city on this night.</summary>
    private Task<int> SlotsHeldAsync(string city, DateOnly night, CancellationToken ct) => (
        from b in db.Set<SignBooking>()
        where b.Format == SignBooking.TonightSlot && b.StartsOn == night && (b.Status == SignBooking.PendingReview || b.Status == SignBooking.Approved)
        join v in db.VenueProfiles on b.VenueId equals (Guid?)v.Id
        where v.CitySlug == city
        select b.Id).CountAsync(ct);

    /// <summary>A host books a sign. It waits for the platform admin.</summary>
    public async Task<SignBookingDto> BookAsync(Guid host, SignInput input, CancellationToken ct)
    {
        var venue = await VenueOfAsync(host, ct);
        return await PlaceAsync(host, venue, input, ct);
    }

    /// <summary>The admin books a sign (a brand's, or on a venue's behalf). Approved at once.</summary>
    public async Task<SignBookingDto> AdminBookAsync(Guid admin, SignInput input, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(input.AdvertiserName) || input.AdvertiserName.Trim().Length > 40)
            throw ApiException.Invalid("An advertiser's name is 1 to 40 characters.");
        if (input.CardTitle is { Length: > 80 } || input.CardSubtitle is { Length: > 120 })
            throw ApiException.Invalid("A card title is up to 80 characters, its line up to 120.");
        if (input.VenueId is { } venueId && !await db.VenueProfiles.AnyAsync(v => v.Id == venueId, ct)) throw ApiException.NotFound("Venue");
        return await PlaceAsync(admin, null, input, ct);
    }

    /// <summary>Everything both kinds of booking share. `venue` is the host's venue, null when the admin books.</summary>
    private async Task<SignBookingDto> PlaceAsync(Guid bookedBy, VenueProfile? venue, SignInput input, CancellationToken ct)
    {
        var admin = venue is null;
        if (input.Format is not { } format || !SignBooking.Formats.Contains(format)) throw ApiException.Invalid("Pick a format: facade, hologram or tonightSlot.");
        var text = SignRules.CleanText(input.Text) ?? throw SignInvalid();
        var top = SignRules.CleanColor(input.ColorTop);
        var bottom = SignRules.CleanColor(input.ColorBottom);
        var ink = SignRules.CleanColor(input.Ink);
        if (top is null || bottom is null || ink is null) throw SignInvalid("Colours are six hex digits, like #ff7a18.");
        var artwork = string.IsNullOrWhiteSpace(input.ArtworkUrl) ? null : input.ArtworkUrl.Trim();
        if (artwork is not null && (artwork.Length > 2000 || !Uri.TryCreate(artwork, UriKind.Absolute, out var uri) || uri.Scheme is not ("https" or "http")))
            throw SignInvalid("Artwork is a web address of an uploaded image.");

        var now = Now;
        Party? party = null;
        if (input.PartyId is { } partyId)
        {
            party = await db.Parties.AsNoTracking().FirstOrDefaultAsync(p => p.Id == partyId && !p.IsDeleted && p.Status == PartyStatus.Published && p.EndsAt > now, ct);
            if (party is null || (!admin && party.HostId != bookedBy)) throw ApiException.NotFound("Party");
        }

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var booking = new SignBooking
        {
            Id = Guid.NewGuid(), Format = format, BookedByUserId = bookedBy, PartyId = party?.Id, Text = text,
            ColorTop = top, ColorBottom = bottom, Ink = ink, ArtworkUrl = artwork, CreatedAt = now,
            InvoiceStatus = SignBooking.ToInvoice,
        };
        if (admin)
        {
            booking.VenueId = input.VenueId;
            booking.AdvertiserName = input.AdvertiserName!.Trim();
            booking.PerkId = input.PerkId;
            booking.CardTitle = string.IsNullOrWhiteSpace(input.CardTitle) ? null : input.CardTitle.Trim();
            booking.CardSubtitle = string.IsNullOrWhiteSpace(input.CardSubtitle) ? null : input.CardSubtitle.Trim();
            booking.Status = SignBooking.Approved;
            booking.ReviewedByUserId = bookedBy;
            booking.ReviewedAt = now;
        }
        else
        {
            booking.VenueId = venue!.Id;
            booking.AdvertiserName = venue.VenueName.Length <= 40 ? venue.VenueName : venue.VenueName[..40];
            booking.Status = SignBooking.PendingReview;

            // One host at a time, so two bookings sent together cannot both slip under the limit.
            await LockAsync("signs-host:" + bookedBy, ct);
            var today = SignRules.Today(now, venue.CitySlug);
            var held = await db.Set<SignBooking>().CountAsync(b => b.BookedByUserId == bookedBy && b.VenueId == venue.Id
                && (b.Status == SignBooking.PendingReview || (b.Status == SignBooking.Approved && b.EndsOn >= today)), ct);
            if (held >= SignRules.HostLimit) throw ApiException.Conflict("You can have three signs at a time.", "sign_limit");
        }

        if (format == SignBooking.TonightSlot)
        {
            if (party is null) throw ApiException.Invalid("Pick the party the slot is for.");
            booking.VenueId ??= party.VenueId;
            var city = party.VenueId is { } pv
                ? await db.VenueProfiles.Where(v => v.Id == pv).Select(v => v.CitySlug).FirstAsync(ct)
                : City.Default;
            var night = CityClock.NightDate(party.StartsAt, city);
            await LockAsync($"signs-slot:{city}:{night:yyyy-MM-dd}", ct);
            if (await SlotsHeldAsync(city, night, ct) >= settings.TonightSlotsPerNight)
                throw ApiException.Conflict("Tonight's slots are taken.", "slot_full");
            booking.StartsOn = booking.EndsOn = night;
            booking.Price = settings.TonightSlot;
        }
        else
        {
            if (input.SpotId is not { } spotId) throw ApiException.Invalid("Pick a spot.");
            var spot = await db.Set<SignSpot>().AsNoTracking().FirstOrDefaultAsync(s => s.Id == spotId && s.Active && s.Format == format, ct)
                       ?? throw ApiException.NotFound("Spot");
            // A venue's own wall carries that venue's sign only: no paid sign goes on a venue's building.
            if (spot.VenueId is { } wallOf && wallOf != booking.VenueId) throw ApiException.Forbidden("This wall belongs to a venue.");

            var window = SignRules.Window(SignRules.Today(now, spot.CitySlug));
            var week = input.Week is null ? window[0] : window.FirstOrDefault(w => w.Id == input.Week)
                ?? throw ApiException.Invalid("Pick this week or one of the next eight.");
            await LockAsync("signs-spot:" + spot.Id, ct);
            if ((await TakenAsync([(spot.Id, week.StartsOn)], ct)).Count > 0)
                throw ApiException.Conflict("That spot was just taken for this week.", "spot_taken");
            booking.SpotId = spot.Id;
            booking.StartsOn = week.StartsOn;
            booking.EndsOn = week.EndsOn;
            booking.Price = settings.PriceOf(spot);
        }

        db.Set<SignBooking>().Add(booking);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return (await DtosAsync([booking], ct))[0];
    }

    /// <summary>Waits for a lock on this name until the transaction ends.</summary>
    private Task LockAsync(string name, CancellationToken ct)
    {
        var key = BitConverter.ToInt64(MD5.HashData(Encoding.UTF8.GetBytes(name)), 0);
        return db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock({key})", ct);
    }

    /// <summary>A host withdraws a sign: while it waits for review, or approved and not yet up.</summary>
    public async Task CancelAsync(Guid host, Guid id, CancellationToken ct)
    {
        var booking = await db.Set<SignBooking>().FirstOrDefaultAsync(b => b.Id == id && b.BookedByUserId == host, ct) ?? throw ApiException.NotFound("Sign");
        if (booking.Status is SignBooking.Cancelled or SignBooking.Rejected) return;
        if (booking.Status == SignBooking.Approved && booking.StartsOn <= SignRules.Today(Now, await CityOfAsync(booking, ct)))
            throw ApiException.Conflict("A sign that is already up cannot be cancelled here.", "sign_running");
        booking.Status = SignBooking.Cancelled;
        await db.SaveChangesAsync(ct);
    }

    private async Task<string> CityOfAsync(SignBooking b, CancellationToken ct)
    {
        if (b.SpotId is { } spotId)
            return await db.Set<SignSpot>().Where(s => s.Id == spotId).Select(s => s.CitySlug).FirstOrDefaultAsync(ct) ?? City.Default;
        if (b.VenueId is { } venueId)
            return await db.VenueProfiles.Where(v => v.Id == venueId).Select(v => v.CitySlug).FirstOrDefaultAsync(ct) ?? City.Default;
        return City.Default;
    }

    // ── review ──

    public async Task<List<AdminSignDto>> AdminListAsync(string? status, CancellationToken ct)
    {
        status ??= SignBooking.PendingReview;
        if (status is not (SignBooking.PendingReview or SignBooking.Approved or SignBooking.Rejected or SignBooking.Cancelled))
            throw ApiException.Invalid("Status is pendingReview, approved, rejected or cancelled.");
        var query = db.Set<SignBooking>().AsNoTracking().Where(b => b.Status == status);
        // The review queue oldest first; everything else newest first.
        query = status == SignBooking.PendingReview ? query.OrderBy(b => b.CreatedAt) : query.OrderByDescending(b => b.CreatedAt);
        var bookings = await query.Take(200).ToListAsync(ct);

        var dtos = await DtosAsync(bookings, ct);
        var venueIds = bookings.Where(b => b.VenueId != null).Select(b => b.VenueId!.Value).Distinct().ToList();
        var venues = await db.VenueProfiles.Where(v => venueIds.Contains(v.Id)).ToDictionaryAsync(v => v.Id, v => v.VenueName, ct);
        var bookerKeys = bookings.Select(b => b.BookedByUserId.ToString()).Distinct().ToList();
        var bookers = await db.Users.Where(u => bookerKeys.Contains(u.Id))
            .Select(u => new { u.Id, u.DisplayName, u.UserName }).ToDictionaryAsync(u => u.Id, u => PersonName.Display(u.DisplayName, u.UserName), ct);

        return bookings.Select((b, i) =>
        {
            var d = dtos[i];
            return new AdminSignDto
            {
                Id = d.Id, Format = d.Format, Spot = d.Spot, PartyId = d.PartyId, PartyTitle = d.PartyTitle, Text = d.Text,
                ColorTop = d.ColorTop, ColorBottom = d.ColorBottom, Ink = d.Ink, ArtworkUrl = d.ArtworkUrl, StartsOn = d.StartsOn,
                EndsOn = d.EndsOn, Price = d.Price, Status = d.Status, ReviewNote = d.ReviewNote, InvoiceStatus = d.InvoiceStatus,
                CreatedAt = d.CreatedAt, AdvertiserName = b.AdvertiserName,
                VenueName = b.VenueId is { } v ? venues.GetValueOrDefault(v) : null,
                BookedBy = bookers.GetValueOrDefault(b.BookedByUserId.ToString()) ?? "FindMyParty",
            };
        }).ToList();
    }

    public async Task ApproveAsync(Guid admin, Guid id, CancellationToken ct)
    {
        var booking = await db.Set<SignBooking>().FirstOrDefaultAsync(b => b.Id == id, ct) ?? throw ApiException.NotFound("Sign");
        if (booking.Status == SignBooking.Approved) return;
        if (booking.Status != SignBooking.PendingReview) throw NotPending();
        booking.Status = SignBooking.Approved;
        booking.ReviewedByUserId = admin;
        booking.ReviewedAt = Now;
        await db.SaveChangesAsync(ct);
        await notifier.SendAsync(new Push([booking.BookedByUserId], "sign_reviewed", "Your sign is live", "", new { signId = booking.Id }), ct);
    }

    /// <summary>Turns a sign down, while it waits or after it was approved (a live sign comes off the map).</summary>
    public async Task RejectAsync(Guid admin, Guid id, string? note, CancellationToken ct)
    {
        note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        if (note is { Length: > 300 }) throw ApiException.Invalid("A note is at most 300 characters.");
        var booking = await db.Set<SignBooking>().FirstOrDefaultAsync(b => b.Id == id, ct) ?? throw ApiException.NotFound("Sign");
        if (booking.Status == SignBooking.Rejected) return;
        if (booking.Status == SignBooking.Cancelled) throw NotPending();
        booking.Status = SignBooking.Rejected;
        booking.ReviewNote = note;
        booking.ReviewedByUserId = admin;
        booking.ReviewedAt = Now;
        await db.SaveChangesAsync(ct);
        await notifier.SendAsync(new Push([booking.BookedByUserId], "sign_reviewed", "Your sign was not approved", note ?? "", new { signId = booking.Id }), ct);
    }

    private static ApiException NotPending() => ApiException.Conflict("This sign is not waiting for review.", "sign_not_pending");

    public async Task InvoicedAsync(Guid id, CancellationToken ct)
    {
        var updated = await db.Set<SignBooking>().Where(b => b.Id == id)
            .ExecuteUpdateAsync(s => s.SetProperty(b => b.InvoiceStatus, SignBooking.Invoiced), ct);
        if (updated == 0) throw ApiException.NotFound("Sign");
    }

    // ── shapes ──

    private async Task<List<SignBookingDto>> DtosAsync(IReadOnlyList<SignBooking> bookings, CancellationToken ct)
    {
        var spotIds = bookings.Where(b => b.SpotId != null).Select(b => b.SpotId!.Value).Distinct().ToList();
        var spots = await db.Set<SignSpot>().AsNoTracking().Where(s => spotIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id, ct);
        var partyIds = bookings.Where(b => b.PartyId != null).Select(b => b.PartyId!.Value).Distinct().ToList();
        var parties = await db.Parties.AsNoTracking().Where(p => partyIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, p => p.Title, ct);
        var weeks = bookings.Where(b => b.SpotId != null).Select(b => (b.SpotId!.Value, SignRules.Monday(b.StartsOn))).Distinct().ToList();
        var taken = await TakenAsync(weeks, ct);

        return bookings.Select(b => new SignBookingDto
        {
            Id = b.Id, Format = b.Format,
            Spot = b.SpotId is { } s && spots.TryGetValue(s, out var spot) ? SpotDto(spot, spot.Active && !taken.Contains((s, SignRules.Monday(b.StartsOn)))) : null,
            PartyId = b.PartyId, PartyTitle = b.PartyId is { } p ? parties.GetValueOrDefault(p) : null,
            Text = b.Text, ColorTop = b.ColorTop, ColorBottom = b.ColorBottom, Ink = b.Ink, ArtworkUrl = b.ArtworkUrl,
            StartsOn = b.StartsOn, EndsOn = b.EndsOn, Price = b.Price, Status = b.Status, ReviewNote = b.ReviewNote,
            InvoiceStatus = b.InvoiceStatus, CreatedAt = b.CreatedAt,
        }).ToList();
    }

    // ── the map and the feed ──

    /// <summary>
    /// The signs up in a city today: approved, on a spot, dates including today, not hidden by this viewer.
    /// Holograms first, then in the order they were booked.
    /// </summary>
    public async Task<List<MapSign>> MapAsync(Guid? viewer, string city, CancellationToken ct)
    {
        var now = Now;
        var today = SignRules.Today(now, city);
        var rows = await (
            from b in db.Set<SignBooking>()
            where b.Status == SignBooking.Approved && b.SpotId != null && b.StartsOn <= today && b.EndsOn >= today
            join s in db.Set<SignSpot>() on b.SpotId equals (Guid?)s.Id
            where s.CitySlug == city && s.Active
            where viewer == null || !db.Set<SignHide>().Any(h => h.UserId == viewer && h.SignBookingId == b.Id)
            orderby s.Format == SignSpot.Hologram ? 0 : 1, b.CreatedAt
            select new { b, s }).AsNoTracking().ToListAsync(ct);

        var partyIds = rows.Where(r => r.b.PartyId != null).Select(r => r.b.PartyId!.Value).Distinct().ToList();
        var parties = await db.Parties.AsNoTracking().Where(p => partyIds.Contains(p.Id))
            .Select(p => new { p.Id, p.Title, p.StartsAt, p.VenueId }).ToDictionaryAsync(p => p.Id, ct);
        var venueIds = rows.Select(r => r.b.VenueId).Concat(parties.Values.Select(p => p.VenueId)).OfType<Guid>().Distinct().ToList();
        var venues = await db.VenueProfiles.AsNoTracking().Where(v => venueIds.Contains(v.Id)).ToDictionaryAsync(v => v.Id, v => v.VenueName, ct);
        var perkIds = rows.Where(r => r.b.PerkId != null).Select(r => r.b.PerkId!.Value).Distinct().ToList();
        var costs = perkIds.Count == 0 ? new Dictionary<Guid, int>() : await perkCosts.CostsAsync(perkIds, ct);

        return rows.Select(r =>
        {
            var b = r.b;
            var party = b.PartyId is { } pid && parties.TryGetValue(pid, out var found) ? found : null;
            var venueName = (party?.VenueId ?? b.VenueId) is { } vid ? venues.GetValueOrDefault(vid) : null;
            var title = b.CardTitle ?? party?.Title ?? (b.VenueId is { } ownVenue ? venues.GetValueOrDefault(ownVenue) : null) ?? b.AdvertiserName;
            var subtitle = b.CardSubtitle
                ?? (party is not null ? When(party.StartsAt, city, today) + (venueName is null ? "" : $" at {venueName}")
                : venueName is not null ? $"See what is on at {venueName}."
                : "");
            var own = r.s.VenueId is { } wall && wall == b.VenueId;
            return new MapSign(b.Id, r.s.Format, own, b.AdvertiserName, b.Text, b.ColorTop, b.ColorBottom, b.Ink, b.ArtworkUrl,
                SpotDto(r.s, free: false),
                new MapSignCard(title, subtitle, SignRules.LogoText(b.Text), b.PerkId, b.PartyId, b.VenueId,
                    b.PerkId is { } perk && costs.TryGetValue(perk, out var cost) ? cost : null));
        }).ToList();
    }

    /// <summary>"Tonight, 23:00" or "Fri 13 Nov, 23:00", in the city's time.</summary>
    private static string When(DateTime startsAt, string city, DateOnly today)
    {
        var local = CityClock.Local(startsAt, city);
        var day = CityClock.NightDate(startsAt, city) == today ? "Tonight" : local.ToString("ddd d MMM", CultureInfo.InvariantCulture);
        return $"{day}, {local:HH:mm}";
    }

    public async Task HideAsync(Guid user, Guid signId, CancellationToken ct)
    {
        if (!await db.Set<SignBooking>().AnyAsync(b => b.Id == signId, ct)) throw ApiException.NotFound("Sign");
        if (await db.Set<SignHide>().AnyAsync(h => h.UserId == user && h.SignBookingId == signId, ct)) return;
        db.Set<SignHide>().Add(new SignHide { UserId = user, SignBookingId = signId, CreatedAt = Now });
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException e) when (e.InnerException is Npgsql.PostgresException { SqlState: Npgsql.PostgresErrorCodes.UniqueViolation })
        {
            // Hidden twice at the same moment.
        }
    }

    /// <summary>The parties among these that an approved sign promotes today (in the party's city).</summary>
    public async Task<HashSet<Guid>> SponsoredAsync(IReadOnlyCollection<Guid> partyIds, CancellationToken ct)
    {
        if (partyIds.Count == 0) return [];
        var rows = await (
            from b in db.Set<SignBooking>()
            where b.Status == SignBooking.Approved && b.PartyId != null && partyIds.Contains(b.PartyId.Value)
            join p in db.Parties on b.PartyId equals (Guid?)p.Id
            join v in db.VenueProfiles on p.VenueId equals (Guid?)v.Id into venues
            from v in venues.DefaultIfEmpty()
            select new { PartyId = b.PartyId!.Value, b.StartsOn, b.EndsOn, City = (string?)v.CitySlug }).AsNoTracking().ToListAsync(ct);
        var now = Now;
        return rows.Where(r =>
        {
            var today = SignRules.Today(now, r.City ?? City.Default);
            return r.StartsOn <= today && r.EndsOn >= today;
        }).Select(r => r.PartyId).ToHashSet();
    }
}
