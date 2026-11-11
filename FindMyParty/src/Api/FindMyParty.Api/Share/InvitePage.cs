using FindMyParty.Api.Common;
using FindMyParty.Api.Friends;
using Microsoft.AspNetCore.Mvc;

namespace FindMyParty.Api.Share;

/// <summary>/i/{handle}: the page behind "Invite with a link". Opens the inviter's card in the app.</summary>
[ApiController]
public class InvitePage(FriendService friends, People people, SharePage share) : ControllerBase
{
    [HttpGet("i/{handle}")]
    public async Task<ContentResult> Get(string handle, CancellationToken ct)
    {
        if (await friends.FindIdAsync(handle, ct) is not { } id || !(await people.PeopleAsync([id], ct)).TryGetValue(id, out var person))
            return SharePage.Result(share.NotFound(), StatusCodes.Status404NotFound);

        return SharePage.Result(share.Render(
            $"{People.FirstName(person.DisplayName)} is on FindMyParty",
            "See where the night is.",
            Links.PublicUrl(HttpContext, "/og.png"),
            $"invite/{Uri.EscapeDataString(person.Handle)}"));
    }
}
