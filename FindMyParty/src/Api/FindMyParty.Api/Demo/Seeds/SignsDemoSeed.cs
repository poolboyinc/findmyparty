using FindMyParty.Api.Cities;
using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using FindMyParty.Api.Signs;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Demo.Seeds;

/// <summary>
/// Sign spots in Podgorica on real walls and roofs (measured on the map: design-proposals/data/sign-walls.json),
/// and this week's signs: VOLT (spot 5), AURA|SPRITZ (hologram 1), Kula's own KULA (spot 4), Dr. House (spot 1) and
/// Blok 5 (spot 2), all approved; Monkey's NEON|FRIDAY on spot 7 waiting for review. That leaves facade spots 3, 6 and 8
/// and hologram 2 free. Atlas holds tonight's "Ladies Night" slot. Each week (and each night, for the slot) is made
/// again when missing, unless someone else holds that spot.
/// </summary>
public class SignsDemoSeed(AppDbContext db, SignSettings settings) : IDemoSeed
{
    public int Order => 50;

    private const string Podgorica = City.Default;

    private record Spot(string Format, int Number, string Label, string Area, double Lat, double Lng, double Bearing,
        double Base, double Width, double Height, double Building, string? VenueSlug = null);

    // Facade: point = the wall (0.4 m in front of it), bearing = the way it faces, width = min(wall × 0.7, 16),
    // height = clamp(building × 0.5, 5, 10), base = max(3, building × 0.2). Hologram: the middle of the roof, 10 × 5 m.
    private static readonly Spot[] Spots =
    [
        new(SignSpot.Facade, 1, "Bokeška", "Centar", 42.440832, 19.261714, 112, 3.4, 15.4, 8.5, 17),
        new(SignSpot.Facade, 2, "Bulevar Džordža Vašingtona", "Blok 5", 42.439709, 19.263835, 202, 3.4, 16, 8.5, 17),
        new(SignSpot.Facade, 3, "Njegoševa", "Stara Varoš", 42.440313, 19.263993, 202, 3.4, 16, 8.5, 17),
        new(SignSpot.Facade, 4, "Njegoševa 21", "Centar", 42.441174, 19.264919, 202, 4, 16, 10, 20, VenueSlug: "kula"),
        new(SignSpot.Facade, 5, "Stara Varoš", "Stara Varoš", 42.440357, 19.263409, 202, 3.6, 12.6, 9, 18),
        new(SignSpot.Facade, 6, "Cetinjska", "Preko Morače", 42.439388, 19.264938, 201, 4.4, 16, 10, 22),
        new(SignSpot.Facade, 7, "Oktobarske revolucije", "Stari Aerodrom", 42.441716, 19.263145, 201, 4, 16, 10, 20),
        new(SignSpot.Facade, 8, "Hercegovačka", "Zabjelo", 42.441892, 19.263616, 111, 9.6, 16, 10, 48),
        new(SignSpot.Hologram, 1, "Bokeška", "Centar", 42.44072, 19.262898, 0, 0, 10, 5, 17),
        new(SignSpot.Hologram, 2, "Cetinjska", "Preko Morače", 42.44025, 19.264445, 0, 0, 10, 5, 16),
    ];

    private record Sign(string Key, string Format, int Number, string Text, string Top, string Bottom, string Ink, string Status,
        string? VenueSlug = null, string? Advertiser = null, string? CardTitle = null, string? CardSubtitle = null, bool Volt = false);

    private static readonly Sign[] Signs =
    [
        new("volt", SignSpot.Facade, 5, "VOLT", "#ffd23c", "#ff7a18", "#1a0a00", SignBooking.Approved, VenueSlug: "monkey", Advertiser: "VOLT",
            CardTitle: "First drink on VOLT", CardSubtitle: "Tonight at Monkey, Flame level and up", Volt: true),
        new("aura", SignSpot.Hologram, 1, "AURA|SPRITZ", "#ffb020", "#ffb020", "#ffb020", SignBooking.Approved, Advertiser: "AURA", CardTitle: "AURA Spritz"),
        new("kula", SignSpot.Facade, 4, "KULA", "#3a1bd6", "#ec5b93", "#ffffff", SignBooking.Approved, VenueSlug: "kula"),
        new("dr-house", SignSpot.Facade, 1, "DEEP|CUTS", "#22e6ff", "#3a1bd6", "#ffffff", SignBooking.Approved, VenueSlug: "dr-house"),
        new("blok-5", SignSpot.Facade, 2, "BALKAN|BASS", "#ec5b93", "#ff7a18", "#ffffff", SignBooking.Approved, VenueSlug: "blok-5"),
        new("monkey", SignSpot.Facade, 7, "NEON|FRIDAY", "#ec5b93", "#7b2ff7", "#ffffff", SignBooking.PendingReview, VenueSlug: "monkey"),
    ];

    public async Task SeedAsync(DemoContext demo, CancellationToken ct)
    {
        var spots = new Dictionary<(string, int), SignSpot>();
        foreach (var s in Spots)
        {
            var spot = await db.Set<SignSpot>().FirstOrDefaultAsync(x => x.CitySlug == Podgorica && x.Format == s.Format && x.Number == s.Number, ct);
            if (spot is null)
            {
                spot = new SignSpot
                {
                    Id = demo.IdFor($"signs:spot:{Podgorica}:{s.Format}:{s.Number}"), CitySlug = Podgorica, Format = s.Format, Number = s.Number,
                    Label = s.Label, Area = s.Area, Latitude = s.Lat, Longitude = s.Lng, BearingDeg = s.Bearing, BaseHeightM = s.Base,
                    WidthM = s.Width, HeightM = s.Height, BuildingHeightM = s.Building,
                    VenueId = s.VenueSlug is null ? null : demo.VenueId(s.VenueSlug), Active = true,
                };
                db.Set<SignSpot>().Add(spot);
                await db.SaveChangesAsync(ct);
            }
            spots[(s.Format, s.Number)] = spot;
        }

        var monday = SignRules.Monday(SignRules.Today(demo.Now, Podgorica));
        var week = SignRules.WeekId(monday);
        // Brand signs are the platform's: booked by nobody's account, so they never count towards a host's three.
        var platform = demo.IdFor("signs:platform");
        foreach (var s in Signs)
        {
            var spot = spots[(s.Format, s.Number)];
            var id = demo.IdFor($"signs:{s.Key}:{week}");
            var bookedBy = s.Advertiser is null ? demo.HostId(s.VenueSlug!) : platform; // a venue's own booking is made by its host
            if (await db.Set<SignBooking>().AnyAsync(b => b.Id == id, ct))
            {
                // The owner took Monkey over after this week's signs were made: Monkey's sign is theirs now.
                await db.Set<SignBooking>().Where(b => b.Id == id && b.BookedByUserId != bookedBy)
                    .ExecuteUpdateAsync(set => set.SetProperty(b => b.BookedByUserId, bookedBy), ct);
                continue;
            }
            var held = await db.Set<SignBooking>().AnyAsync(b => b.SpotId == spot.Id && b.StartsOn <= monday.AddDays(6) && b.EndsOn >= monday
                && (b.Status == SignBooking.PendingReview || b.Status == SignBooking.Approved), ct);
            if (held) continue;

            var venueId = s.VenueSlug is null ? (Guid?)null : demo.VenueId(s.VenueSlug);
            var partyId = s.Key == "monkey" ? demo.UpcomingPartyIds("monkey").FirstOrDefault() : (Guid?)null;
            db.Set<SignBooking>().Add(new SignBooking
            {
                Id = id, Format = s.Format, SpotId = spot.Id,
                BookedByUserId = bookedBy,
                VenueId = venueId, PartyId = partyId == Guid.Empty ? null : partyId,
                PerkId = s.Volt ? demo.IdFor("perk:volt") : null,
                AdvertiserName = s.Advertiser ?? await VenueNameAsync(venueId!.Value, ct),
                Text = s.Text, ColorTop = s.Top, ColorBottom = s.Bottom, Ink = s.Ink,
                CardTitle = s.CardTitle, CardSubtitle = s.CardSubtitle,
                StartsOn = monday, EndsOn = monday.AddDays(6),
                Price = settings.PriceOf(spot),
                Status = s.Status, ReviewedAt = s.Status == SignBooking.Approved ? demo.Now : null,
                InvoiceStatus = SignBooking.ToInvoice, CreatedAt = demo.Now,
            });
            await db.SaveChangesAsync(ct);
        }

        await TonightSlotAsync(demo, ct);
    }

    /// <summary>Atlas's "Ladies Night" in tonight's slot, made again each night.</summary>
    private async Task TonightSlotAsync(DemoContext demo, CancellationToken ct)
    {
        Guid partyId;
        try { partyId = demo.RunningPartyId("atlas"); }
        catch (KeyNotFoundException) { return; }
        var party = await db.Parties.AsNoTracking().Where(p => p.Id == partyId).Select(p => new { p.StartsAt }).FirstAsync(ct);
        var night = CityClock.NightDate(party.StartsAt, Podgorica);
        var id = demo.IdFor($"signs:atlas-slot:{night:yyyy-MM-dd}");
        if (await db.Set<SignBooking>().AnyAsync(b => b.Id == id || (b.PartyId == partyId && b.Format == SignBooking.TonightSlot), ct)) return;

        var venueId = demo.VenueId("atlas");
        db.Set<SignBooking>().Add(new SignBooking
        {
            Id = id, Format = SignBooking.TonightSlot, BookedByUserId = demo.HostId("atlas"), VenueId = venueId, PartyId = partyId,
            AdvertiserName = await VenueNameAsync(venueId, ct), Text = "LADIES|NIGHT", ColorTop = "#ec5b93", ColorBottom = "#ffb020", Ink = "#ffffff",
            StartsOn = night, EndsOn = night, Price = settings.TonightSlot, Status = SignBooking.Approved, ReviewedAt = demo.Now,
            InvoiceStatus = SignBooking.ToInvoice, CreatedAt = demo.Now,
        });
        await db.SaveChangesAsync(ct);
    }

    private Task<string> VenueNameAsync(Guid venueId, CancellationToken ct) =>
        db.VenueProfiles.Where(v => v.Id == venueId).Select(v => v.VenueName).FirstAsync(ct);
}
