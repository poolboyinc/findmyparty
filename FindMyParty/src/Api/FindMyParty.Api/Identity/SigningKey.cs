namespace FindMyParty.Api.Identity;

public static class SigningKey
{
    public const string DevelopmentPrefix = "DEV_ONLY";

    /// <summary>
    /// Stops the service from starting with a key that would let anyone forge sign-in tokens:
    /// a missing or short key anywhere, or the development key outside development.
    /// </summary>
    public static void Require(string? key, bool isDevelopment)
    {
        if (string.IsNullOrWhiteSpace(key) || key.Length < 32)
            throw new InvalidOperationException("Jwt:Key is missing or shorter than 32 characters. Set the Jwt__Key environment variable to a long random value.");
        if (!isDevelopment && key.StartsWith(DevelopmentPrefix, StringComparison.Ordinal))
            throw new InvalidOperationException("Jwt:Key is the development key. Set the Jwt__Key environment variable to a long random value.");
    }
}
