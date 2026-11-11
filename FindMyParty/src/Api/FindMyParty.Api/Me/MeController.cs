using FindMyParty.Api.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FindMyParty.Api.Me;

/// <summary>The signed-in account: names, city, taste and sound, level, privacy and notification switches.</summary>
[ApiController]
[Authorize]
[Route("api/me")]
public class MeController(MeService me) : ControllerBase
{
    [HttpGet]
    public Task<MeResponse> Get(CancellationToken ct) => me.GetAsync(User.UserId(), ct);

    /// <summary>Changes only what is sent. `400 name_invalid`, `city_unknown`, `taste_invalid`.</summary>
    [HttpPatch]
    public Task<MeResponse> Update(UpdateMeRequest request, CancellationToken ct) => me.UpdateAsync(User.UserId(), request, ct);
}
