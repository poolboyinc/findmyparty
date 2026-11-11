using System.Buffers.Text;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using FindMyParty.Api.Common;

namespace FindMyParty.Api.SignArt;

/// <summary>
/// What a sign looks like, read from the word in its address: URL-safe base64 (no padding) of the UTF-8 text
/// <c>v1\n{top}\n{bottom}\n{ink}\n{widthM}\n{heightM}\n{text}</c>. The phone builds it in
/// <c>components/city/signs.ts</c> (<c>signArtCode</c>). Colours are "#rrggbb" here.
/// </summary>
public sealed partial record SignArtSpec(string Top, string Bottom, string Ink, double WidthM, double HeightM, string Text)
{
    public const string ErrorCode = "sign_art_invalid";
    public const int MaxCharacters = 24;
    public const int MaxLines = 2;
    public const double MinMetres = 1;
    public const double MaxMetres = 40;
    /// <summary>Far more than the longest valid code (24 four-byte characters and the rest); stops work on junk early.</summary>
    private const int MaxCodeLength = 512;

    private static readonly UTF8Encoding StrictUtf8 = new(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true);

    /// <summary>The text's lines (<c>|</c> breaks a line).</summary>
    public string[] Lines => Text.Split('|');

    public static SignArtSpec Parse(string code)
    {
        if (code.Length is 0 or > MaxCodeLength || !CodeChars().IsMatch(code)) throw Invalid("The code is not URL-safe base64.");

        string decoded;
        try
        {
            decoded = StrictUtf8.GetString(Base64Url.DecodeFromChars(code));
        }
        catch (FormatException)
        {
            throw Invalid("The code is not URL-safe base64.");
        }
        catch (ArgumentException)
        {
            throw Invalid("The code is not UTF-8 text.");
        }

        var parts = decoded.Split('\n');
        if (parts.Length != 7) throw Invalid("The code needs seven lines: version, three colours, two sizes and the text.");
        if (parts[0] != "v1") throw Invalid("Unknown sign-art version.");

        var top = Colour(parts[1]);
        var bottom = Colour(parts[2]);
        var ink = Colour(parts[3]);
        var width = Metres(parts[4]);
        var height = Metres(parts[5]);

        var text = parts[6];
        var characters = text.Replace("|", "", StringComparison.Ordinal).Length;
        if (characters is < 1 or > MaxCharacters) throw Invalid($"The text is 1 to {MaxCharacters} characters.");
        if (text.Split('|').Length > MaxLines) throw Invalid($"The text has at most {MaxLines} lines.");

        return new SignArtSpec(top, bottom, ink, width, height, text);
    }

    private static string Colour(string value) =>
        HexColour().IsMatch(value) ? "#" + value : throw Invalid("A colour is six lower-case hex digits.");

    private static double Metres(string value)
    {
        if (!MetresPattern().IsMatch(value)) throw Invalid("A size is metres with at most one decimal.");
        var metres = double.Parse(value, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture);
        return metres is >= MinMetres and <= MaxMetres ? metres : throw Invalid($"A size is {MinMetres} to {MaxMetres} metres.");
    }

    private static ApiException Invalid(string title) => ApiException.Invalid(title, ErrorCode);

    [GeneratedRegex("^[A-Za-z0-9_-]+$")]
    private static partial Regex CodeChars();

    [GeneratedRegex("^[0-9a-f]{6}$")]
    private static partial Regex HexColour();

    [GeneratedRegex(@"^(0|[1-9][0-9]{0,2})(\.[0-9])?$")]
    private static partial Regex MetresPattern();
}
