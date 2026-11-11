namespace FindMyParty.Api.Me;

/// <summary>A genre and its share of someone's sound ("Techno 52%").</summary>
public record SoundShare(string Genre, int Percent);

/// <summary>The genres a guest can pick (S-02) and how "Your sound" is worked out from picks or from scans.</summary>
public static class Taste
{
    /// <summary>In the order the pads are drawn. The phone's `TASTE_ORDER` is the same list.</summary>
    public static readonly IReadOnlyList<string> Genres = ["Techno", "House", "Hip-Hop", "Balkan", "Live", "Pop", "Latin", "R&B", "Rock"];

    /// <summary>The stored column ("Techno,House") as a list; empty when nothing was picked.</summary>
    public static List<string> Parse(string? stored) =>
        string.IsNullOrWhiteSpace(stored) ? [] : stored.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();

    /// <summary>
    /// The picks in their canonical spelling and in pick order, repeats dropped; null when one is not on the list,
    /// is blank, or there are more than nine.
    /// </summary>
    public static List<string>? Normalise(IReadOnlyList<string?> picks)
    {
        if (picks.Count > Genres.Count) return null;
        var result = new List<string>();
        foreach (var pick in picks)
        {
            var genre = Genres.FirstOrDefault(g => string.Equals(g, pick?.Trim(), StringComparison.OrdinalIgnoreCase));
            if (genre is null) return null;
            if (!result.Contains(genre)) result.Add(genre);
        }
        return result;
    }

    // With no scans the bars are drawn 5:3:2, as on S-02.
    private static readonly int[][] FromPicks = [[], [100], [62, 38], [52, 30, 18]];

    /// <summary>
    /// Three genres at most, whole percentages adding up to 100. From the parties scanned into when there are any
    /// (most first, by name on a tie), else from the first three picks.
    /// </summary>
    public static List<SoundShare> Sound(IReadOnlyDictionary<string, int> scannedGenres, IReadOnlyList<string> picks)
    {
        var top = scannedGenres.Where(g => g.Value > 0)
            .OrderByDescending(g => g.Value).ThenBy(g => g.Key, StringComparer.Ordinal)
            .Take(3).ToList();
        if (top.Count == 0)
        {
            var first = picks.Take(3).ToList();
            return first.Select((genre, i) => new SoundShare(genre, FromPicks[first.Count][i])).ToList();
        }

        var percents = LargestRemainder(top.Select(g => g.Value).ToList());
        return top.Select((g, i) => new SoundShare(g.Key, percents[i])).ToList();
    }

    /// <summary>Whole percentages that add up to 100: round down, then hand the rest to the largest remainders (earlier first on a tie).</summary>
    public static int[] LargestRemainder(IReadOnlyList<int> counts)
    {
        var total = counts.Sum();
        var percents = counts.Select(c => c * 100 / total).ToArray();
        var left = 100 - percents.Sum();
        foreach (var i in Enumerable.Range(0, counts.Count).OrderByDescending(i => counts[i] * 100 % total).ThenBy(i => i).Take(left))
            percents[i]++;
        return percents;
    }
}
