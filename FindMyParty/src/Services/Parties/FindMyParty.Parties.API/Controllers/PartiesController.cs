using FindMyParty.Parties.API.Application.Commands;
using FindMyParty.Parties.API.Application.DTOs;
using FindMyParty.Parties.API.Application.Handlers;
using FindMyParty.Parties.API.Application.Queries;
using FindMyParty.Parties.API.Infrastructure.Data;
using FindMyParty.Parties.API.Infrastructure.Storage;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Distributed;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;
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
    IS3ImageService s3) : ControllerBase
{

    [Authorize(Roles = "Host")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePartyRequest request)
    {
        var hostId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var id = await createHandler.Handle(
            new CreatePartyCommand(hostId, request));

        return CreatedAtAction(nameof(GetById), new { id }, new { id });
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
        const int maxDimension = 2048;
        const int maxBytes = 10 * 1024 * 1024;

        if (file == null || file.Length == 0)
            return BadRequest("No file provided.");
        if (file.Length > maxBytes)
            return BadRequest("Image is larger than 10 MB.");

        var hostId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var party = await db.Parties.FindAsync(id);
        if (party == null) return NotFound();
        if (party.HostId != hostId) return Forbid();

        // Decode the image via ImageSharp. This:
        //   1. Verifies it is actually an image (not a renamed executable / polyglot).
        //   2. Throws on malformed/exploit payloads.
        //   3. Gives us dimensions so we can cap them.
        // We then re-encode to JPEG, which strips EXIF (including GPS) and
        // normalizes the content type — so we never trust the client's filename/content-type.
        Image image;
        try
        {
            await using var sourceStream = file.OpenReadStream();
            image = await Image.LoadAsync(sourceStream);
        }
        catch (Exception)
        {
            return BadRequest("File is not a valid image.");
        }

        using (image)
        {
            if (image.Width > maxDimension || image.Height > maxDimension)
            {
                image.Mutate(ctx => ctx.Resize(new ResizeOptions
                {
                    Mode = ResizeMode.Max,
                    Size = new Size(maxDimension, maxDimension),
                }));
            }

            // Always write JPEG regardless of source format. Keeps things simple and safe.
            using var outputStream = new MemoryStream();
            await image.SaveAsync(outputStream, new JpegEncoder { Quality = 85 });
            outputStream.Position = 0;

            var key = $"parties/{id}.jpg";
            var imageUrl = await s3.UploadAsync(outputStream, key, "image/jpeg");

            party.SetImageUrl(imageUrl);
            await db.SaveChangesAsync();

            return Ok(new { imageUrl });
        }
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
            isSoldOut = party.TicketsSold >= party.Capacity,
            pricePerTicket = party.Price,
            endsAt = party.EndsAt
        };

        await cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(result),
            new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(10)
            });

        return Ok(result);
    }
}
