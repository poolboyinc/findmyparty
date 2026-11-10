using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;

namespace FindMyParty.Api.Bookings;

/// <summary>
/// The code inside a pass's QR. It is HMAC-SHA256(secret, time step), so it changes every half minute
/// and the phone can compute it with no connection. The app has the same function in TypeScript.
/// </summary>
public static class PassCode
{
    public const int StepSeconds = 30;
    private const string Prefix = "fmp1";

    /// <summary>The half-minute window a moment falls in.</summary>
    public static long StepAt(DateTime utc) =>
        new DateTimeOffset(DateTime.SpecifyKind(utc, DateTimeKind.Utc)).ToUnixTimeSeconds() / StepSeconds;

    /// <summary>Eight lowercase hex characters for this secret and window.</summary>
    public static string Compute(string secretBase64, long step)
    {
        Span<byte> message = stackalloc byte[8];
        BinaryPrimitives.WriteInt64BigEndian(message, step);
        var mac = HMACSHA256.HashData(Convert.FromBase64String(secretBase64), message);
        return Convert.ToHexString(mac, 0, 4).ToLowerInvariant();
    }

    /// <summary>
    /// True for the current window, the two before it and the one after: enough for a slow scan and a phone
    /// clock that is a little off, short enough that a forwarded screenshot goes stale.
    /// </summary>
    public static bool IsCurrent(string secretBase64, string code, DateTime nowUtc)
    {
        var now = StepAt(nowUtc);
        var given = Encoding.ASCII.GetBytes(code);
        var ok = false;
        for (var step = now - 2; step <= now + 1; step++)
            ok |= CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(Compute(secretBase64, step)), given);
        return ok;
    }

    public static string NewSecret() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));

    /// <summary>The text encoded in the QR: "fmp1.{booking id}.{code}".</summary>
    public static string Format(Guid bookingId, string code) => $"{Prefix}.{bookingId:N}.{code}";

    public static bool TryParse(string? text, out Guid bookingId, out string code)
    {
        bookingId = default;
        code = "";
        var parts = text?.Split('.');
        if (parts is not [Prefix, var id, var c] || !Guid.TryParseExact(id, "N", out bookingId)) return false;
        if (c.Length != 8 || !c.All(Uri.IsHexDigit)) return false;
        code = c.ToLowerInvariant();
        return true;
    }
}
