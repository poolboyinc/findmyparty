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
    public const string BookingPrefix = "fmp1";
    /// <summary>A guest pass: same code scheme, its own id and secret.</summary>
    public const string GuestPrefix = "fmpg1";

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
    public static string Format(Guid bookingId, string code) => $"{BookingPrefix}.{bookingId:N}.{code}";

    /// <summary>A guest pass's QR: "fmpg1.{guest pass id}.{code}".</summary>
    public static string FormatGuest(Guid guestPassId, string code) => $"{GuestPrefix}.{guestPassId:N}.{code}";

    /// <summary>Reads a booking's own QR only.</summary>
    public static bool TryParse(string? text, out Guid bookingId, out string code) =>
        TryParse(text, out var guest, out bookingId, out code) && !guest;

    /// <summary>Reads a booking's QR or a guest pass's. `guest` says which; `id` is the booking or guest pass id.</summary>
    public static bool TryParse(string? text, out bool guest, out Guid id, out string code)
    {
        guest = false;
        id = default;
        code = "";
        var parts = text?.Trim().Split('.');
        if (parts is not [var prefix, var raw, var c] || !Guid.TryParseExact(raw, "N", out id)) return false;
        if (prefix == GuestPrefix) guest = true;
        else if (prefix != BookingPrefix) return false;
        if (c.Length != 8 || !c.All(Uri.IsHexDigit)) return false;
        code = c.ToLowerInvariant();
        return true;
    }
}
