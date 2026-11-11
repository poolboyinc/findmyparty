namespace FindMyParty.Api.Common;

/// <summary>A Glow level. `Next` is the lifetime Glow at which the following level starts; null at the top.</summary>
public record GlowLevel(string Name, int Number, int Min, int? Next);

/// <summary>The five levels. A level comes from lifetime Glow and never goes down.</summary>
public static class GlowLevels
{
    public static readonly IReadOnlyList<GlowLevel> All =
    [
        new("Spark", 1, 0, 300),
        new("Ember", 2, 300, 1000),
        new("Flame", 3, 1000, 2000),
        new("Blaze", 4, 2000, 4000),
        new("Inferno", 5, 4000, null),
    ];

    public static GlowLevel For(int lifetime) => All.LastOrDefault(l => lifetime >= l.Min) ?? All[0];

    /// <summary>The level with this number (1 to 5); numbers outside that are pulled to the nearest end.</summary>
    public static GlowLevel ByNumber(int number) => All[Math.Clamp(number, 1, All.Count) - 1];
}
