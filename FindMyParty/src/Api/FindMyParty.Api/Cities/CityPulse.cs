namespace FindMyParty.Api.Cities;

/// <summary>"1,200+ out tonight": the city's crowd, rounded down so the number always reads as "at least".</summary>
public static class CityPulse
{
    /// <summary>To 10 under 50, to 50 under 1,000, else to 100.</summary>
    public static int RoundDown(int people) => people switch
    {
        <= 0 => 0,
        < 50 => people / 10 * 10,
        < 1000 => people / 50 * 50,
        _ => people / 100 * 100
    };
}
