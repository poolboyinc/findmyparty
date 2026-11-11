using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FindMyParty.Api.SignArt;

/// <summary>
/// The pictures the map draws signs from. Everything is in the address (no query string: the iOS map drops it
/// when it fetches a 3D model), so an answer never changes and may be cached for ever.
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/sign-art")]
public class SignArtController(SignArtCache art) : ControllerBase
{
    public const string CacheControl = "public, max-age=31536000, immutable";

    /// <summary>The flat face of a wall panel.</summary>
    [HttpGet("face/{code}.png")]
    public IActionResult Face(string code) => Send(art.Get(SignArtKind.Face, code), "image/png");

    /// <summary>A hologram with its cone of light, on a transparent background.</summary>
    [HttpGet("hologram/{code}.png")]
    public IActionResult Hologram(string code) => Send(art.Get(SignArtKind.Hologram, code), "image/png");

    /// <summary>One upright 1 m × 1 m square carrying the face.</summary>
    [HttpGet("panel/{code}.glb")]
    public IActionResult Panel(string code) => Send(art.Get(SignArtKind.Panel, code), "model/gltf-binary");

    private FileContentResult Send(byte[] bytes, string contentType)
    {
        Response.Headers.CacheControl = CacheControl;
        return File(bytes, contentType);
    }
}
