using FindMyParty.Api.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FindMyParty.Api.Me;

/// <summary>"Saved venues and parties" (S-18), kept on the account instead of the phone.</summary>
[ApiController]
[Authorize]
[Route("api/me/saved")]
public class SavedController(SavedService saved) : ControllerBase
{
    [HttpGet]
    public Task<SavedResponse> Get(CancellationToken ct) => saved.ListAsync(User.UserId(), ct);

    /// <summary>`kind` is `party` or `venue`. Saving again is fine; an unknown target is 404.</summary>
    [HttpPut("{kind}/{id:guid}")]
    public async Task<IActionResult> Save(string kind, Guid id, CancellationToken ct)
    {
        await saved.SaveAsync(User.UserId(), kind, id, ct);
        return NoContent();
    }

    [HttpDelete("{kind}/{id:guid}")]
    public async Task<IActionResult> Unsave(string kind, Guid id, CancellationToken ct)
    {
        await saved.UnsaveAsync(User.UserId(), kind, id, ct);
        return NoContent();
    }

    /// <summary>One-time upload of what the phone saved before. Unknown ids are skipped.</summary>
    [HttpPost("import")]
    public Task<SavedResponse> Import(ImportSavedRequest request, CancellationToken ct) => saved.ImportAsync(User.UserId(), request, ct);
}
