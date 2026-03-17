using FindMyParty.Parties.API.Application.Commands;
using FindMyParty.Parties.API.Application.DTOs;
using FindMyParty.Parties.API.Application.Handlers;
using FindMyParty.Parties.API.Application.Queries;
using FindMyParty.Parties.API.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Distributed;
using System.Security.Claims;
using System.Text.Json;

[ApiController]
[Route("api/parties")]
public class PartiesController(
    CreatePartyCommandHandler createHandler,
    PublishPartyCommandHandler publishHandler,
    UpdatePartyCommandHandler updateHandler,
    CancelPartyCommandHandler cancelHandler,
    DeletePartyCommandHandler deleteHandler,
    GetPublishedPartiesQueryHandler queryHandler,
    GetPartyByIdQueryHandler getByIdHandler,
    GetHostPartiesQueryHandler hostPartiesHandler,
    PartiesDbContext db,
    IDistributedCache cache,
    IWebHostEnvironment env) : ControllerBase
{
    [Authorize(Roles = "Host")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePartyRequest request)
    {
        var hostId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var id = await createHandler.Handle(
            new CreatePartyCommand(hostId, request));

        return CreatedAtAction(nameof(Get), new { id }, null);
    }

    [Authorize(Roles = "Host")]
    [HttpPost("{id:guid}/publish")]
    public async Task<IActionResult> Publish(Guid id)
    {
        var hostId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var result = await publishHandler.Handle(new PublishPartyCommand(id, hostId));

        return result switch
        {
            PublishPartyResult.Success => NoContent(),
            PublishPartyResult.NotFound => NotFound(),
            PublishPartyResult.Forbidden => Forbid(),
            PublishPartyResult.InvalidState => BadRequest("Party cannot be published in its current state."),
            _ => StatusCode(500)
        };
    }

    [Authorize(Roles = "Host")]
    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePartyRequest request)
    {
        var hostId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var result = await updateHandler.Handle(new UpdatePartyCommand(id, hostId, request));

        return result switch
        {
            UpdatePartyResult.Success => NoContent(),
            UpdatePartyResult.NotFound => NotFound(),
            UpdatePartyResult.Forbidden => Forbid(),
            UpdatePartyResult.InvalidState => BadRequest("Only draft parties can be edited."),
            _ => StatusCode(500)
        };
    }

    [Authorize(Roles = "Host")]
    [HttpPost("{id:guid}/cancel")]
    public async Task<IActionResult> Cancel(Guid id)
    {
        var hostId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var result = await cancelHandler.Handle(new CancelPartyCommand(id, hostId));

        return result switch
        {
            CancelPartyResult.Success => NoContent(),
            CancelPartyResult.NotFound => NotFound(),
            CancelPartyResult.Forbidden => Forbid(),
            _ => StatusCode(500)
        };
    }

    [Authorize(Roles = "Host")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var hostId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var result = await deleteHandler.Handle(new DeletePartyCommand(id, hostId));

        return result switch
        {
            DeletePartyResult.Success => NoContent(),
            DeletePartyResult.NotFound => NotFound(),
            DeletePartyResult.Forbidden => Forbid(),
            DeletePartyResult.InvalidState => BadRequest("Only draft parties can be deleted."),
            _ => StatusCode(500)
        };
    }

    [Authorize(Roles = "Host")]
    [HttpGet("mine")]
    public async Task<IActionResult> GetMine()
    {
        var hostId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var parties = await hostPartiesHandler.Handle(new GetHostPartiesQuery(hostId));
        return Ok(parties);
    }

    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] double? lat,
        [FromQuery] double? lng,
        [FromQuery] DateOnly? date,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var parties = await queryHandler.Handle(
            new GetPublishedPartiesQuery(lat, lng, date, page, pageSize));

        return Ok(parties);
    }


    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var party = await getByIdHandler.Handle(new GetPartyByIdQuery(id));

        if (party == null)
            return NotFound();

        return Ok(party);
    }

    [Authorize(Roles = "Host")]
    [HttpPost("{id:guid}/image")]
    [RequestSizeLimit(10 * 1024 * 1024)] // 10 MB
    public async Task<IActionResult> UploadImage(Guid id, IFormFile file)
    {
        var hostId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var party = await db.Parties.FindAsync(id);
        if (party == null) return NotFound();
        if (party.HostId != hostId) return Forbid();

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var allowed = new[] { ".jpg", ".jpeg", ".png", ".webp" };
        if (!allowed.Contains(ext)) return BadRequest("Only jpg, png and webp images are allowed.");

        var imagesDir = Path.Combine(env.WebRootPath, "images", "parties");
        Directory.CreateDirectory(imagesDir);

        var fileName = $"{id}{ext}";
        var filePath = Path.Combine(imagesDir, fileName);

        using (var stream = System.IO.File.Create(filePath))
            await file.CopyToAsync(stream);

        var imageUrl = $"{Request.Scheme}://{Request.Host}/images/parties/{fileName}";
        party.SetImageUrl(imageUrl);
        await db.SaveChangesAsync();

        return Ok(new { imageUrl });
    }

    [HttpGet("{id}/availability")]
    public async Task<IActionResult> GetAvailability(Guid id)
    {
        var cacheKey = $"parties:availability:{id}";

        var cached = await cache.GetStringAsync(cacheKey);
        if (cached != null)
            return Ok(JsonSerializer.Deserialize<object>(cached));

        var party = await db.Parties.FindAsync(id);

        if (party == null)
            return NotFound();

        var result = new
        {
            remainingCapacity = party.Capacity - party.TicketsSold,
            isAvailable = party.TicketsSold < party.Capacity,
            pricePerTicket = party.Price
        };

        await cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(result),
            new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(10)
            });

        return Ok(result);
    }
}
