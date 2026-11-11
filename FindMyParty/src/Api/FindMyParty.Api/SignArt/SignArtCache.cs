using Microsoft.Extensions.Caching.Memory;

namespace FindMyParty.Api.SignArt;

public enum SignArtKind { Face, Hologram, Panel }

/// <summary>
/// Sign pictures by address. The address is the content, so a drawn picture never goes stale; a small cache of its
/// own (by bytes, so the map asking for many signs cannot grow it without bound) saves redrawing the ones in view.
/// </summary>
public sealed class SignArtCache(SignArtRenderer renderer) : IDisposable
{
    /// <summary>A face is about 50 KB, so this keeps a few hundred pictures.</summary>
    public const long SizeLimitBytes = 16 * 1024 * 1024;

    private readonly MemoryCache _cache = new(new MemoryCacheOptions { SizeLimit = SizeLimitBytes });

    /// <summary>The picture for a code, drawn once. Throws <c>400 sign_art_invalid</c> for a bad code.</summary>
    public byte[] Get(SignArtKind kind, string code)
    {
        var key = (kind, code);
        if (_cache.TryGetValue(key, out byte[]? cached) && cached is not null) return cached;

        var spec = SignArtSpec.Parse(code);
        var bytes = kind switch
        {
            SignArtKind.Face => renderer.Face(spec),
            SignArtKind.Hologram => renderer.Hologram(spec),
            // The panel carries the face: reuse it when it is already drawn.
            SignArtKind.Panel => QuadGlb.Build(Get(SignArtKind.Face, code)),
            _ => throw new ArgumentOutOfRangeException(nameof(kind)),
        };
        _cache.Set(key, bytes, new MemoryCacheEntryOptions { Size = bytes.Length });
        return bytes;
    }

    public void Dispose() => _cache.Dispose();
}
