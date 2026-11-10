using FindMyParty.Api.Bookings;
using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using FindMyParty.Api.Identity;
using FindMyParty.Api.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Parties;

[ApiController]
[Route("api/parties")]
public class PartiesController(AppDbContext db, IImageStorage images, PartyReader reader, PassService passes) : ControllerBase
{
    [Authorize(Roles = Roles.Host)]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] PartyRequest request)
    {
        var hostId = User.UserIdString();
        var venueId = await db.VenueProfiles.Where(v => v.UserId == hostId).Select(v => (Guid?)v.Id).FirstOrDefaultAsync();
        var party = new Party(User.UserId(), venueId, request);
        db.Parties.Add(party);
        await db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = party.Id }, new { id = party.Id });
    }

    [Authorize(Roles = Roles.Host)]
    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] PartyRequest request)
    {
        var party = await OwnedPartyAsync(id);
        if (party.Status != PartyStatus.Draft) return BadRequest("Only draft parties can be edited.");
        party.Update(request);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [Authorize(Roles = Roles.Host)]
    [HttpPost("{id:guid}/publish")]
    public async Task<IActionResult> Publish(Guid id)
    {
        var party = await OwnedPartyAsync(id);
        try
        {
            party.Publish();
        }
        catch (InvalidOperationException)
        {
            return BadRequest("Party cannot be published in its current state.");
        }
        await db.SaveChangesAsync();
        return NoContent();
    }

    [Authorize(Roles = Roles.Host)]
    [HttpPost("{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id)
    {
        var party = await OwnedPartyAsync(id);

        // The party, its bookings and its held spots change together or not at all.
        await using var tx = await db.Database.BeginTransactionAsync();
        party.Cancel();
        await db.SaveChangesAsync();
        await db.Bookings
            .Where(b => b.PartyId == id && b.Status != BookingStatus.Cancelled)
            .ExecuteUpdateAsync(s => s.SetProperty(b => b.Status, BookingStatus.Cancelled));
        await db.Parties.Where(p => p.Id == id).ExecuteUpdateAsync(s => s.SetProperty(p => p.TicketsSold, 0));
        await tx.CommitAsync();
        return NoContent();
    }

    [Authorize(Roles = Roles.Host)]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var party = await OwnedPartyAsync(id);
        if (party.Status != PartyStatus.Draft) return BadRequest("Only draft parties can be deleted.");
        party.Delete();
        await db.SaveChangesAsync();
        return NoContent();
    }

    [Authorize(Roles = Roles.Host)]
    [HttpGet("mine")]
    public async Task<IActionResult> GetMine()
    {
        var hostId = User.UserId();
        var parties = await db.Parties
            .Where(p => p.HostId == hostId && !p.IsDeleted && p.Status != PartyStatus.Cancelled)
            .OrderByDescending(p => p.StartsAt)
            .Select(p => new HostPartyResponse
            {
                Id = p.Id,
                Title = p.Title,
                Description = p.Description,
                Price = p.Price,
                Capacity = p.Capacity,
                TicketsSold = p.TicketsSold,
                StartsAt = p.StartsAt,
                EndsAt = p.EndsAt,
                Latitude = p.Latitude,
                Longitude = p.Longitude,
                Status = p.Status.ToString(),
                ImageUrl = p.ImageUrl,
                // Exact only while price cannot change after publishing and there are no discounts.
                Revenue = p.TicketsSold * p.Price,
                Genre = p.Genre,
                PerformerName = p.PerformerName,
                PerformerType = p.PerformerType,
                Featured = p.Featured
            })
            .ToListAsync();
        return Ok(parties);
    }

    /// <summary>
    /// Published parties that have not ended, soonest first.
    /// Pass lat, lng and radiusKm together to get only parties within that distance.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] double? lat,
        [FromQuery] double? lng,
        [FromQuery] double? radiusKm,
        [FromQuery] DateOnly? date,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = reader.Open();
        if (date.HasValue)
        {
            var dayStart = date.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
            var dayEnd = date.Value.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);
            query = query.Where(p => p.StartsAt <= dayEnd && p.EndsAt >= dayStart);
        }
        if (lat is { } lat0 && lng is { } lng0 && radiusKm is > 0)
        {
            // A cheap box first (plain comparisons), then the exact great-circle distance.
            var (dLat, dLng) = Geo.Box(lat0, radiusKm.Value);
            var r = radiusKm.Value;
            const double toRad = Geo.ToRad;
            query = query
                .Where(p => p.Latitude >= lat0 - dLat && p.Latitude <= lat0 + dLat && p.Longitude >= lng0 - dLng && p.Longitude <= lng0 + dLng)
                .Where(p => 6371 * 2 * Math.Asin(Math.Sqrt(
                    Math.Pow(Math.Sin((p.Latitude - lat0) * toRad / 2), 2) +
                    Math.Cos(lat0 * toRad) * Math.Cos(p.Latitude * toRad) * Math.Pow(Math.Sin((p.Longitude - lng0) * toRad / 2), 2))) <= r);
        }

        return Ok(await reader.ToResponsesAsync(query.OrderBy(p => p.StartsAt).Skip((page - 1) * pageSize).Take(pageSize)));
    }

    /// <summary>The night in numbers, for the party's host.</summary>
    [Authorize(Roles = Roles.Host)]
    [HttpGet("{id:guid}/live")]
    public async Task<IActionResult> Live(Guid id, CancellationToken ct) => Ok(await passes.LiveAsync(User.UserId(), id, ct));

    /// <summary>A party's details. Drafts are visible to their host only.</summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var p = await db.Parties.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
        if (p == null) return NotFound();
        if (p.Status == PartyStatus.Draft && !(User.Identity?.IsAuthenticated == true && p.HostId == User.UserId())) return NotFound();

        return Ok(new PartyDetailResponse
        {
            Id = p.Id,
            Title = p.Title,
            Description = p.Description,
            Price = p.Price,
            Capacity = p.Capacity,
            TicketsSold = p.TicketsSold,
            StartsAt = p.StartsAt,
            EndsAt = p.EndsAt,
            Latitude = p.Latitude,
            Longitude = p.Longitude,
            IsSoldOut = p.TicketsSold >= p.Capacity,
            ImageUrl = p.ImageUrl,
            VenueId = p.VenueId,
            VenueName = p.VenueId == null ? null : await db.VenueProfiles.Where(v => v.Id == p.VenueId).Select(v => v.VenueName).FirstOrDefaultAsync(),
            Genre = p.Genre,
            PerformerName = p.PerformerName,
            PerformerType = p.PerformerType
        });
    }

    [HttpGet("{id:guid}/availability")]
    public async Task<IActionResult> GetAvailability(Guid id)
    {
        var p = await db.Parties.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted && x.Status != PartyStatus.Draft);
        if (p == null) return NotFound();

        return Ok(new
        {
            remainingCapacity = p.Capacity - p.TicketsSold,
            isSoldOut = p.TicketsSold >= p.Capacity,
            pricePerTicket = p.Price,
            endsAt = p.EndsAt
        });
    }

    [Authorize(Roles = Roles.Host)]
    [HttpPost("{id:guid}/image")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<IActionResult> UploadImage(Guid id, IFormFile file, CancellationToken ct)
    {
        var party = await OwnedPartyAsync(id);
        if (!images.IsConfigured)
            return Problem(statusCode: StatusCodes.Status503ServiceUnavailable, title: "Image storage is not set up yet.");

        await using var stream = file.OpenReadStream();
        // The type comes from the bytes, not from the file name or what the client claims.
        var kind = await ImageSniffer.DetectAsync(stream, ct);
        if (kind is null) return BadRequest("Only JPEG, PNG and WebP images are allowed.");

        // A fresh name per upload: nothing is overwritten and cached copies never go stale.
        var imageUrl = await images.UploadAsync(stream, $"parties/{id}/{Guid.NewGuid():N}{kind.Extension}", kind.ContentType, ct);
        party.SetImageUrl(imageUrl);
        await db.SaveChangesAsync(ct);
        return Ok(new { imageUrl });
    }

    /// <summary>The party, if it exists and belongs to the signed-in host.</summary>
    private async Task<Party> OwnedPartyAsync(Guid id)
    {
        var party = await db.Parties.FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted) ?? throw ApiException.NotFound("Party");
        if (party.HostId != User.UserId()) throw ApiException.Forbidden();
        return party;
    }
}
