using FindMyParty.Parties.API.Application.Commands;
using FindMyParty.Parties.API.Application.DTOs;
using FindMyParty.Parties.API.Application.Handlers;
using FindMyParty.Parties.API.Application.Queries;
using FindMyParty.Parties.API.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

[ApiController]
[Route("api/parties")]
public class PartiesController( CreatePartyCommandHandler createHandler, GetPublishedPartiesQueryHandler queryHandler, PartiesDbContext db) : ControllerBase
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


    /*
    [HttpGet("{id}/availability")]
    public async Task<IActionResult> GetAvailability(Guid id)
    {
        var party = await queryHandler.Handle(new GetPartyByIdQuery(id));
        // OR use DbContext directly if you prefer

        if (party == null)
            return NotFound();

        var remainingCapacity = party.Capacity - party.TicketsSold;

        return Ok(new PartyAvailabilityResult(
            RemainingCapacity: remainingCapacity,
            IsAvailable: remainingCapacity > 0
        ));
    }
    */

    [HttpGet("{id}/availability")]
    public async Task<IActionResult> GetAvailability(Guid id)
    {
        var party = await db.Parties.FindAsync(id);

        if (party == null)
            return NotFound();

        var remainingCapacity = party.Capacity - party.TicketsSold;

        return Ok(new
        {
            remainingCapacity,
            isAvailable = remainingCapacity > 0
        });
    }
}
