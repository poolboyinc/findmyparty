namespace FindMyParty.Api.Parties;

/// <summary>How busy a party is, as the public sees it: a range, never the exact number.</summary>
public static class Crowd
{
    public const string Live = "live";
    public const string Expected = "expected";

    /// <summary>
    /// Once anyone has been scanned in, the level comes from the door ("live").
    /// Until then it comes from passes taken ("expected"), so a venue that has not started scanning still shows something honest.
    /// </summary>
    public static (string Level, string Source) Of(int passesOut, int checkedIn) =>
        checkedIn > 0 ? (Level(checkedIn), Live) : (Level(passesOut), Expected);

    public static string Level(int people) => people switch
    {
        >= 200 => "200+",
        >= 100 => "100+",
        >= 50 => "50+",
        >= 20 => "20+",
        _ => "quiet"
    };
}
