using FindMyParty.Parties.API.Application.Commands;
using FindMyParty.Parties.API.Application.DTOs;
using FindMyParty.Parties.API.Application.Handlers;
using FindMyParty.Parties.API.Application.Queries;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

[ApiController]
[Route("api/parties")]
public class PartiesController( CreatePartyCommandHandler createHandler, GetPublishedPartiesQueryHandler queryHandler) : ControllerBase
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
}
