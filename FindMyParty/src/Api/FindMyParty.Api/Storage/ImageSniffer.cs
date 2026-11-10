namespace FindMyParty.Api.Storage;

public record ImageKind(string Extension, string ContentType);

/// <summary>Recognises an image by its first bytes.</summary>
public static class ImageSniffer
{
    /// <summary>Returns the image type, or null if this is not a JPEG, PNG or WebP. Leaves the stream at its start.</summary>
    public static async Task<ImageKind?> DetectAsync(Stream stream, CancellationToken ct = default)
    {
        var head = new byte[12];
        var read = await stream.ReadAtLeastAsync(head, head.Length, throwOnEndOfStream: false, ct);
        stream.Position = 0;
        var h = head.AsSpan(0, read);

        if (h.StartsWith<byte>([0xFF, 0xD8, 0xFF])) return new ImageKind(".jpg", "image/jpeg");
        if (h.StartsWith<byte>([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) return new ImageKind(".png", "image/png");
        if (h.Length >= 12 && h[..4].SequenceEqual("RIFF"u8) && h[8..12].SequenceEqual("WEBP"u8)) return new ImageKind(".webp", "image/webp");
        return null;
    }
}
