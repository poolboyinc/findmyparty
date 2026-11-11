using System.Runtime.InteropServices;
using SkiaSharp;

namespace FindMyParty.Api.SignArt;

/// <summary>
/// Draws sign pictures. A port of the app's reference drawing,
/// <c>MobileApp/tools/city-preview/sign-art.mjs</c> (<c>drawFace</c>, <c>drawHologram</c>): same sizes and
/// proportions, with Canvas 2D's rules (rounding, "middle" baseline, shadows, "lighter") done the same way.
/// Stateless and thread-safe.
/// </summary>
public sealed class SignArtRenderer
{
    private static readonly Lazy<SKTypeface> Coolvetica = new(LoadFont);

    /// <summary>
    /// The face of a wall panel: a gradient from the top colour to the bottom colour, a thin light line just inside
    /// the edge, the text centred in ink. 48 px per metre, the longer side at most 768 px.
    /// </summary>
    public byte[] Face(SignArtSpec spec)
    {
        var perMetre = Math.Min(48, 768 / Math.Max(spec.WidthM, spec.HeightM));
        var width = JsRound(spec.WidthM * perMetre);
        var height = JsRound(spec.HeightM * perMetre);

        using var surface = NewSurface(width, height);
        var canvas = surface.Canvas;

        using (var gradient = SKShader.CreateLinearGradient(new SKPoint(0, 0), new SKPoint(0, height),
                   [Colour(spec.Top), Colour(spec.Bottom)], SKShaderTileMode.Clamp))
        using (var fill = new SKPaint { Shader = gradient })
            canvas.DrawRect(0, 0, width, height, fill);

        var line = Math.Max(2, JsRound(height * 0.012));
        using (var edge = new SKPaint())
        {
            edge.IsAntialias = true;
            edge.Style = SKPaintStyle.Stroke;
            edge.StrokeWidth = line;
            edge.Color = new SKColor(255, 255, 255, Alpha(0.75));
            canvas.DrawRect(line * 1.5f, line * 1.5f, width - line * 3f, height - line * 3f, edge);
        }

        var lines = spec.Lines;
        var longest = Math.Max(lines.Max(l => l.Length), 1);
        var size = Math.Min(height / (lines.Length + 0.4), width * 0.94 / (longest * 0.5));
        // The guess above takes a letter as half its size wide; Coolvetica's capitals are wider. Measured, the
        // longest line may take FaceTextShare of the face, so the words stay inside the light edge.
        size = Fit(lines, size, width * FaceTextShare);
        using var font = Font(size);
        using var ink = new SKPaint { IsAntialias = true, Color = Colour(spec.Ink) };
        for (var i = 0; i < lines.Length; i++)
        {
            var middle = height / 2.0 + (i - (lines.Length - 1) / 2.0) * size * 1.02 + size * 0.04;
            using var text = Centred(lines[i], font, width / 2.0, Baseline(font, middle));
            if (text is not null) canvas.DrawText(text, 0, 0, ink);
        }

        return Png(surface);
    }

    /// <summary>
    /// A hologram on a transparent background: a see-through panel outlined in the top colour, scan lines across
    /// it, glowing text, and under it a cone of light narrowing to the point on the roof it rises from. Drawn at 3×
    /// for a picture (w + 12) × (h + lift + 10) points, anchored at its bottom middle; the sizes in metres only set
    /// the proportions (4.6 points per metre).
    /// </summary>
    public byte[] Hologram(SignArtSpec spec)
    {
        const int scale = 3;
        const double s = 1.37;
        var w = Math.Clamp(spec.WidthM * 4.6, 30, 80) * s;
        var h = Math.Clamp(spec.HeightM * 4.6, 14, 40) * s;
        const double lift = 22 * s;
        const double pad = 6;
        var width = (int)Math.Ceiling(w + pad * 2);
        var height = (int)Math.Ceiling(h + lift + pad + 4);

        using var surface = NewSurface(width * scale, height * scale);
        var canvas = surface.Canvas;
        canvas.Scale(scale);

        var x = width / 2.0;
        var foot = height - 2.0;
        var yb = foot - lift;
        var top = Colour(spec.Top);
        // Canvas shadows: sigma is half of shadowBlur, in device pixels. Skia maps a paint's filter through the
        // canvas scale, so divide it back out.
        SKImageFilter Glow(double shadowBlur) =>
            SKImageFilter.CreateDropShadowOnly(0, 0, (float)(shadowBlur / 2 / scale), (float)(shadowBlur / 2 / scale), top);

        // The cone of light, from the roof up to the panel.
        using (var gradient = SKShader.CreateLinearGradient(new SKPoint(0, (float)foot), new SKPoint(0, (float)yb),
                   [top.WithAlpha(Alpha(0.5)), top.WithAlpha(Alpha(0.04))], SKShaderTileMode.Clamp))
        using (var cone = Paint(SKPaintStyle.Fill))
        using (var outline = new SKPathBuilder())
        {
            cone.Shader = gradient;
            outline.MoveTo((float)(x - 2), (float)foot);
            outline.LineTo((float)(x + 2), (float)foot);
            outline.LineTo((float)(x + w / 2), (float)yb);
            outline.LineTo((float)(x - w / 2), (float)yb);
            outline.Close();
            using var path = outline.Detach();
            canvas.DrawPath(path, cone);
        }

        // The panel: a faint fill and a bright outline, each glowing.
        var panel = new SKRect((float)(x - w / 2), (float)(yb - h), (float)(x + w / 2), (float)yb);
        using (var glow = Glow(12 * scale))
        using (var fill = Paint(SKPaintStyle.Fill))
        using (var outline = Paint(SKPaintStyle.Stroke))
        {
            fill.Color = top.WithAlpha(Alpha(0.16));
            outline.Color = top.WithAlpha(Alpha(0.95));
            outline.StrokeWidth = 1.2f;
            foreach (var paint in new[] { fill, outline })
            {
                paint.ImageFilter = glow;
                canvas.DrawRect(panel, paint);
                paint.ImageFilter = null;
                canvas.DrawRect(panel, paint);
            }
        }

        // Scan lines.
        using (var scan = Paint(SKPaintStyle.Stroke))
        {
            scan.Color = top.WithAlpha(Alpha(0.18));
            scan.StrokeWidth = 0.5f;
            for (var y = yb - h + 2; y < yb; y += 2.5)
                canvas.DrawLine((float)(x - w / 2 + 1), (float)y, (float)(x + w / 2 - 1), (float)y, scan);
        }

        // The text, glowing in the top colour.
        var lines = spec.Lines;
        var longest = Math.Max(lines.Max(l => l.Length), 1);
        var size = Math.Min((h - 4) / lines.Length, (w - 6) / (longest * 0.6));
        size = Fit(lines, size, (w - 6) * HologramTextShare);
        using var font = Font(size);
        using var textGlow = Glow(8 * scale);
        using var text = Paint(SKPaintStyle.Fill);
        text.Color = top;
        for (var i = 0; i < lines.Length; i++)
        {
            var middle = yb - h / 2 + (i - (lines.Length - 1) / 2.0) * size * 1.02 + size * 0.04;
            using var run = Centred(lines[i], font, x, Baseline(font, middle));
            if (run is null) continue;
            text.ImageFilter = textGlow;
            canvas.DrawText(run, 0, 0, text);
            text.ImageFilter = null;
            canvas.DrawText(run, 0, 0, text);
        }

        return Png(surface);
    }

    /// <summary>The GLB for a wall panel: one upright 1 m square carrying the face.</summary>
    public byte[] Panel(SignArtSpec spec) => QuadGlb.Build(Face(spec));

    // ── Canvas 2D's rules ──

    /// <summary>Math.round: halves go up (C#'s default would go to even).</summary>
    private static int JsRound(double value) => (int)Math.Floor(value + 0.5);

    private static byte Alpha(double alpha) => (byte)JsRound(alpha * 255);

    /// <summary>
    /// textBaseline "middle": the middle of the em box sits on <paramref name="middle"/>. Chrome takes the em box
    /// from the font's OS/2 typo ascender and descender, scaled to one em (for Coolvetica 0.767 and 0.233, so the
    /// baseline is 0.267 em below the middle; the hhea numbers would put the text a tenth of an em too low).
    /// </summary>
    private static float Baseline(SKFont font, double middle) => (float)(middle + font.Size * MiddleToBaselineEm.Value);

    private static readonly Lazy<double> MiddleToBaselineEm = new(() =>
    {
        const uint os2 = 0x4F532F32; // "OS/2"
        if (Coolvetica.Value.TryGetTableData(os2, out var table) && table is { Length: >= 72 })
        {
            double ascender = System.Buffers.Binary.BinaryPrimitives.ReadInt16BigEndian(table.AsSpan(68));
            double descender = System.Buffers.Binary.BinaryPrimitives.ReadInt16BigEndian(table.AsSpan(70)); // negative
            if (ascender - descender > 0) return (ascender + descender) / (2 * (ascender - descender));
        }
        using var font = new SKFont(Coolvetica.Value, 1);
        return (-font.Metrics.Ascent - font.Metrics.Descent) / 2;
    });

    /// <summary>The share of a face's width its longest line may take, and of a hologram's panel.</summary>
    public const double FaceTextShare = 0.8;
    public const double HologramTextShare = 0.9;

    /// <summary><paramref name="size"/>, made smaller if the widest line at that size is wider than <paramref name="room"/>.</summary>
    private static double Fit(string[] lines, double size, double room)
    {
        using var font = Font(size);
        var widest = lines.Max(line => KernedWidth(line, font));
        return widest > room && widest > 0 ? size * room / widest : size;
    }

    /// <summary>How wide one line is in this font, kerned like the browser does.</summary>
    private static double KernedWidth(string line, SKFont font)
    {
        if (line.Length == 0) return 0;
        var glyphs = font.GetGlyphs(line);
        var width = (double)font.MeasureText(MemoryMarshal.AsBytes(glyphs.AsSpan()), SKTextEncoding.GlyphId);
        if (glyphs.Length > 1)
        {
            var pairs = new int[glyphs.Length - 1];
            if (font.Typeface.GetKerningPairAdjustments(glyphs, pairs))
                width += pairs.Sum() * (double)font.Size / font.Typeface.UnitsPerEm;
        }
        return width;
    }

    /// <summary>
    /// One line of text centred on <paramref name="centre"/>, kerned like the browser does (the font's kerning
    /// pairs pull "VO" and "LT" together; without them the line comes out a tenth wider than the reference).
    /// Null for an empty line ("AURA|"), which draws nothing.
    /// </summary>
    private static SKTextBlob? Centred(string line, SKFont font, double centre, float baseline)
    {
        if (line.Length == 0) return null;
        var glyphs = font.GetGlyphs(line);
        var positions = font.GetGlyphPositions(glyphs, SKPoint.Empty);
        var width = (double)font.MeasureText(MemoryMarshal.AsBytes(glyphs.AsSpan()), SKTextEncoding.GlyphId);
        if (glyphs.Length > 1)
        {
            var pairs = new int[glyphs.Length - 1];
            if (font.Typeface.GetKerningPairAdjustments(glyphs, pairs))
            {
                var perUnit = font.Size / font.Typeface.UnitsPerEm;
                var shift = 0.0;
                for (var i = 1; i < glyphs.Length; i++)
                {
                    shift += pairs[i - 1] * perUnit;
                    positions[i].X += (float)shift;
                }
                width += shift;
            }
        }
        var left = (float)(centre - width / 2);
        for (var i = 0; i < positions.Length; i++) positions[i] = new SKPoint(positions[i].X + left, baseline);

        using var builder = new SKTextBlobBuilder();
        builder.AddPositionedRun(glyphs, font, positions);
        return builder.Build() ?? throw new InvalidOperationException("Could not lay out the sign's text.");
    }

    /// <summary>Everything in the hologram adds light ("lighter").</summary>
    private static SKPaint Paint(SKPaintStyle style) => new() { IsAntialias = true, Style = style, BlendMode = SKBlendMode.Plus };

    private static SKFont Font(double size) =>
        new(Coolvetica.Value, (float)size) { Subpixel = true, Edging = SKFontEdging.Antialias, Hinting = SKFontHinting.None };

    private static SKColor Colour(string hex) => SKColor.Parse(hex);

    private static SKSurface NewSurface(int width, int height)
    {
        var surface = SKSurface.Create(new SKImageInfo(width, height, SKColorType.Rgba8888, SKAlphaType.Premul))
                      ?? throw new InvalidOperationException($"Could not make a {width}×{height} surface.");
        surface.Canvas.Clear(SKColors.Transparent);
        return surface;
    }

    private static byte[] Png(SKSurface surface)
    {
        using var image = surface.Snapshot();
        using var data = image.Encode(SKEncodedImageFormat.Png, 100);
        return data.ToArray();
    }

    private static SKTypeface LoadFont()
    {
        const string name = "FindMyParty.Api.SignArt.coolvetica.ttf";
        using var stream = typeof(SignArtRenderer).Assembly.GetManifestResourceStream(name)
                           ?? throw new InvalidOperationException($"The embedded font {name} is missing.");
        using var data = SKData.Create(stream);
        return SKTypeface.FromData(data) ?? throw new InvalidOperationException($"The embedded font {name} could not be read.");
    }
}
