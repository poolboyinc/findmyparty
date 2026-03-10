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
    GetPublishedPartiesQueryHandler queryHandler,
    GetPartyByIdQueryHandler getByIdHandler,
    PartiesDbContext db,
    IDistributedCache cache) : ControllerBase
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

    [HttpGet]
    public async Task<IActionResult> Get(
        [FromQuery] double? lat,
        [FromQuery] double? lng,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var parties = await queryHandler.Handle(
            new GetPublishedPartiesQuery(lat, lng, page, pageSize));

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
