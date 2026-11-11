using System.Buffers.Binary;
using System.Buffers.Text;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using FindMyParty.Api.SignArt;
using Microsoft.Extensions.DependencyInjection;
using SkiaSharp;

namespace FindMyParty.Api.Tests;

/// <summary>Sign art: the pictures the map draws signs from, made from the sign's address alone.</summary>
[Collection("api")]
public class SignArtTests(TestApp app)
{
    private static readonly byte[] PngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

    /// <summary>The address word, as the phone's signArtCode builds it.</summary>
    private static string Code(string top, string bottom, string ink, string width, string height, string text) =>
        Encode($"v1\n{top}\n{bottom}\n{ink}\n{width}\n{height}\n{text}");

    private static string Encode(string text) => Base64Url.EncodeToString(Encoding.UTF8.GetBytes(text));

    private static readonly string Volt = Code("ffd23c", "ff7a18", "1a0a00", "12", "8", "VOLT");
    private static readonly string Kula = Code("3a1bd6", "ec5b93", "ffffff", "12", "8", "KULA");
    private static readonly string Aura = Code("ffb020", "ffb020", "ffb020", "10", "5", "AURA|SPRITZ");

    private async Task<HttpResponseMessage> GetAsync(string kind, string code)
    {
        var extension = kind == "panel" ? "glb" : "png";
        return await app.CreateClient().GetAsync($"/api/sign-art/{kind}/{code}.{extension}");
    }

    private async Task<byte[]> BytesAsync(string kind, string code)
    {
        var response = await GetAsync(kind, code);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadAsByteArrayAsync();
    }

    private static (int Width, int Height) PngSize(byte[] png)
    {
        Assert.True(png.AsSpan().StartsWith(PngSignature), "not a PNG");
        Assert.Equal("IHDR", Encoding.ASCII.GetString(png, 12, 4));
        return (BinaryPrimitives.ReadInt32BigEndian(png.AsSpan(16)), BinaryPrimitives.ReadInt32BigEndian(png.AsSpan(20)));
    }

    private static bool Near(SKColor actual, SKColor expected, int tolerance = 6) =>
        Math.Abs(actual.Red - expected.Red) <= tolerance && Math.Abs(actual.Green - expected.Green) <= tolerance &&
        Math.Abs(actual.Blue - expected.Blue) <= tolerance && Math.Abs(actual.Alpha - expected.Alpha) <= tolerance;

    // ── the face ──

    [Theory]
    [InlineData("12", "8", 576, 384)]       // 48 px per metre
    [InlineData("12.5", "3", 600, 144)]
    [InlineData("1", "1", 48, 48)]
    [InlineData("40", "10", 768, 192)]      // the longer side stops at 768
    [InlineData("6", "40", 115, 768)]       // 6 × 19.2 = 115.2
    public async Task A_face_is_a_png_of_48_px_per_metre_with_the_longer_side_at_most_768(string width, string height, int pxWide, int pxTall)
    {
        var response = await GetAsync("face", Code("ffd23c", "ff7a18", "1a0a00", width, height, "VOLT"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("image/png", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal((pxWide, pxTall), PngSize(await response.Content.ReadAsByteArrayAsync()));
    }

    [Fact]
    public async Task A_face_runs_from_the_top_colour_to_the_bottom_colour_with_the_text_in_ink()
    {
        using var face = SKBitmap.Decode(await BytesAsync("face", Volt));

        Assert.True(Near(face.GetPixel(0, 0), SKColor.Parse("#ffd23c")), face.GetPixel(0, 0).ToString());
        Assert.True(Near(face.GetPixel(0, face.Height - 1), SKColor.Parse("#ff7a18")), face.GetPixel(0, face.Height - 1).ToString());
        var ink = SKColor.Parse("#1a0a00");
        var inked = 0;
        for (var y = 0; y < face.Height; y += 2)
        for (var x = 0; x < face.Width; x += 2)
            if (Near(face.GetPixel(x, y), ink, 2)) inked++;
        // VOLT fills a good part of the panel.
        Assert.InRange(inked / (double)(face.Width * face.Height / 4), 0.15, 0.6);
    }

    // ── the hologram ──

    [Theory]
    [InlineData("10", "5", 228, 216)]   // the demo AURA hologram
    [InlineData("12", "8", 264, 273)]
    [InlineData("40", "40", 366, 285)]  // panel at its largest
    [InlineData("1", "1", 162, 180)]    // panel at its smallest
    public async Task A_hologram_is_a_png_drawn_at_three_times_its_point_size(string width, string height, int pxWide, int pxTall)
    {
        var response = await GetAsync("hologram", Code("ffb020", "ffb020", "ffb020", width, height, "AURA|SPRITZ"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("image/png", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal((pxWide, pxTall), PngSize(await response.Content.ReadAsByteArrayAsync()));
    }

    [Fact]
    public async Task A_hologram_stands_on_a_transparent_background_and_glows_in_its_colour()
    {
        var png = await BytesAsync("hologram", Aura);
        using var hologram = SKBitmap.Decode(png);

        Assert.Equal(6, png[25]); // PNG colour type 6: RGB with alpha
        // Beside the narrow foot of the cone nothing is drawn; the top corners only catch the last of the glow.
        Assert.Equal(0, hologram.GetPixel(0, hologram.Height - 1).Alpha);
        Assert.Equal(0, hologram.GetPixel(hologram.Width - 1, hologram.Height - 1).Alpha);
        Assert.InRange(hologram.GetPixel(0, 0).Alpha, (byte)0, (byte)8);
        Assert.InRange(hologram.GetPixel(hologram.Width - 1, 0).Alpha, (byte)0, (byte)8);
        // The foot of the cone, at the bottom middle, is lit.
        var foot = hologram.GetPixel(hologram.Width / 2, hologram.Height - 9);
        Assert.True(foot.Alpha > 60, foot.ToString());
        Assert.True(foot.Red > foot.Blue, foot.ToString());
    }

    // ── the panel ──

    [Fact]
    public async Task A_panel_is_a_glb_square_carrying_the_face()
    {
        var response = await GetAsync("panel", Volt);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("model/gltf-binary", response.Content.Headers.ContentType?.MediaType);
        var glb = await response.Content.ReadAsByteArrayAsync();
        var face = await BytesAsync("face", Volt);

        Assert.Equal("glTF", Encoding.ASCII.GetString(glb, 0, 4));
        Assert.Equal(2u, BinaryPrimitives.ReadUInt32LittleEndian(glb.AsSpan(4)));
        Assert.Equal((uint)glb.Length, BinaryPrimitives.ReadUInt32LittleEndian(glb.AsSpan(8)));

        var jsonLength = (int)BinaryPrimitives.ReadUInt32LittleEndian(glb.AsSpan(12));
        Assert.Equal("JSON", Encoding.ASCII.GetString(glb, 16, 4));
        Assert.Equal(0, jsonLength % 4);
        using var json = JsonDocument.Parse(glb.AsMemory(20, jsonLength));
        var binStart = 20 + jsonLength;
        var binLength = (int)BinaryPrimitives.ReadUInt32LittleEndian(glb.AsSpan(binStart));
        Assert.Equal("BIN\0", Encoding.ASCII.GetString(glb, binStart + 4, 4));
        Assert.Equal(glb.Length, binStart + 8 + binLength);
        var bin = glb.AsSpan(binStart + 8, binLength);

        var root = json.RootElement;
        Assert.Equal("2.0", root.GetProperty("asset").GetProperty("version").GetString());
        var images = root.GetProperty("images");
        Assert.Equal(1, images.GetArrayLength());
        Assert.Equal("image/png", images[0].GetProperty("mimeType").GetString());
        var view = root.GetProperty("bufferViews")[images[0].GetProperty("bufferView").GetInt32()];
        var png = bin.Slice(view.GetProperty("byteOffset").GetInt32(), view.GetProperty("byteLength").GetInt32()).ToArray();
        Assert.Equal(face, png);

        // One upright 1 m square, both sides drawn, lit by its own picture.
        var position = root.GetProperty("accessors")[0];
        Assert.Equal("[-0.5,0,0]", position.GetProperty("min").GetRawText());
        Assert.Equal("[0.5,1,0]", position.GetProperty("max").GetRawText());
        var positionView = root.GetProperty("bufferViews")[position.GetProperty("bufferView").GetInt32()];
        var corners = System.Runtime.InteropServices.MemoryMarshal.Cast<byte, float>(
            bin.Slice(positionView.GetProperty("byteOffset").GetInt32(), positionView.GetProperty("byteLength").GetInt32())).ToArray();
        Assert.Equal([-0.5f, 0, 0, 0.5f, 0, 0, 0.5f, 1, 0, -0.5f, 1, 0], corners);
        var material = root.GetProperty("materials")[0];
        Assert.True(material.GetProperty("doubleSided").GetBoolean());
        Assert.Equal(0, material.GetProperty("pbrMetallicRoughness").GetProperty("baseColorTexture").GetProperty("index").GetInt32());
        Assert.Equal(0, material.GetProperty("emissiveTexture").GetProperty("index").GetInt32());
        Assert.Equal("[1,1,1]", material.GetProperty("emissiveFactor").GetRawText());
    }

    // ── caching ──

    [Theory]
    [InlineData("face")]
    [InlineData("hologram")]
    [InlineData("panel")]
    public async Task Every_picture_may_be_cached_for_ever_and_the_same_code_gives_the_same_bytes(string kind)
    {
        var code = Code("3a1bd6", "ec5b93", "ffffff", "9.5", "6", "SAME|" + kind.ToUpperInvariant());

        var first = await GetAsync(kind, code);
        var second = await GetAsync(kind, code);

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        var cacheControl = first.Headers.CacheControl!;
        Assert.True(cacheControl.Public);
        Assert.Equal(TimeSpan.FromSeconds(31536000), cacheControl.MaxAge);
        Assert.Contains(cacheControl.Extensions, e => e.Name == "immutable");
        Assert.Equal(await first.Content.ReadAsByteArrayAsync(), await second.Content.ReadAsByteArrayAsync());
    }

    [Fact]
    public void Drawing_is_deterministic_without_the_cache()
    {
        var renderer = app.Services.GetRequiredService<SignArtRenderer>();
        var spec = SignArtSpec.Parse(Kula);

        Assert.Equal(renderer.Face(spec), renderer.Face(spec));
        Assert.Equal(renderer.Hologram(spec), renderer.Hologram(spec));
        Assert.Equal(renderer.Panel(spec), renderer.Panel(spec));
    }

    // ── refusals ──

    public static TheoryData<string, string> Refused => new()
    {
        { "not base64", "VOLT*" },
        { "a padded code", Encode("v1\nffd23c\nff7a18\n1a0a00\n12\n8\nVOLTS") + "=" },
        { "a length base64 cannot have", "A" },
        { "not UTF-8", Base64Url.EncodeToString([0xff, 0xfe, 0x0a]) },
        { "too few lines", Encode("v1\nffd23c\nff7a18\n1a0a00\n12\n8") },
        { "a newline in the text", Code("ffd23c", "ff7a18", "1a0a00", "12", "8", "VO\nLT") },
        { "another version", Encode("v2\nffd23c\nff7a18\n1a0a00\n12\n8\nVOLT") },
        { "a colour of five digits", Code("ffd23", "ff7a18", "1a0a00", "12", "8", "VOLT") },
        { "a colour that is not hex", Code("ffd23c", "gg7a18", "1a0a00", "12", "8", "VOLT") },
        { "a colour with #", Code("ffd23c", "ff7a18", "#1a0a0", "12", "8", "VOLT") },
        { "an upper-case colour", Code("FFD23C", "ff7a18", "1a0a00", "12", "8", "VOLT") },
        { "a width under 1 m", Code("ffd23c", "ff7a18", "1a0a00", "0.9", "8", "VOLT") },
        { "a height over 40 m", Code("ffd23c", "ff7a18", "1a0a00", "12", "40.1", "VOLT") },
        { "two decimals", Code("ffd23c", "ff7a18", "1a0a00", "12.25", "8", "VOLT") },
        { "a size that is not a number", Code("ffd23c", "ff7a18", "1a0a00", "twelve", "8", "VOLT") },
        { "a negative size", Code("ffd23c", "ff7a18", "1a0a00", "-12", "8", "VOLT") },
        { "a size in exponent form", Code("ffd23c", "ff7a18", "1a0a00", "1e1", "8", "VOLT") },
        { "no text", Code("ffd23c", "ff7a18", "1a0a00", "12", "8", "") },
        { "only a line break", Code("ffd23c", "ff7a18", "1a0a00", "12", "8", "|") },
        { "25 characters", Code("ffd23c", "ff7a18", "1a0a00", "12", "8", new string('A', 25)) },
        { "three lines", Code("ffd23c", "ff7a18", "1a0a00", "12", "8", "A|B|C") },
    };

    [Theory]
    [MemberData(nameof(Refused))]
    public async Task A_bad_code_is_refused_on_every_endpoint(string why, string code)
    {
        foreach (var kind in new[] { "face", "hologram", "panel" })
        {
            var response = await GetAsync(kind, code);
            Assert.True(response.StatusCode == HttpStatusCode.BadRequest, $"{why} on {kind}: {response.StatusCode}");
            var problem = await response.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(SignArtSpec.ErrorCode, problem.GetProperty("code").GetString());
            Assert.Null(response.Headers.CacheControl?.MaxAge);
        }
    }

    [Theory]
    [InlineData("1", "40", "ABCDEFGHIJKL|MNOPQRSTUVWX")] // 24 characters on two lines; the | does not count
    [InlineData("40", "1", "Neon Bašta|ŠĆ")]
    [InlineData("12.5", "7.5", "AURA|")]
    public async Task The_limits_themselves_are_drawn(string width, string height, string text)
    {
        foreach (var kind in new[] { "face", "hologram", "panel" })
        {
            var response = await GetAsync(kind, Code("ffd23c", "ff7a18", "1a0a00", width, height, text));
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
    }

    // ── the demo pictures, for the lead to look at ──

    [Fact]
    public async Task The_demo_pictures_are_written_to_tmp_for_a_look()
    {
        const string folder = "/tmp/sign-art-samples";
        Directory.CreateDirectory(folder);

        var samples = new (string File, string Kind, string Code)[]
        {
            ("volt-face.png", "face", Volt),
            ("kula-face.png", "face", Kula),
            ("aura-spritz-hologram.png", "hologram", Aura),
            ("volt-panel.glb", "panel", Volt),
        };
        foreach (var (file, kind, code) in samples)
        {
            var bytes = await BytesAsync(kind, code);
            await File.WriteAllBytesAsync(Path.Combine(folder, file), bytes);
            Assert.True(new FileInfo(Path.Combine(folder, file)).Length > 1000);
        }
    }
}
