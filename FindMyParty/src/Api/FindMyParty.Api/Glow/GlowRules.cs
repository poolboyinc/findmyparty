using FindMyParty.Api.Common;

namespace FindMyParty.Api.Glow;

/// <summary>The numbers of spec §2.3 "Glow", as pure functions over night dates.</summary>
public static class GlowRules
{
    public const int ScanPoints = 100;
    public const int BeforeMidnightPoints = 25;
    public const int FirstAtVenuePoints = 50;
    public const int StreakPoints = 25;
    public const int ReferralPoints = 200;
    /// <summary>The weekend streak from which every scan counts ×1.5.</summary>
    public const int MultiplierFromWeek = 4;
    /// <summary>Weekends in a row before a streak pays.</summary>
    public const int StreakPaysFromWeek = 2;

    /// <summary>The Friday on or before this night: the key of its weekend.</summary>
    public static DateOnly FridayOf(DateOnly night) => night.AddDays(-(((int)night.DayOfWeek - (int)DayOfWeek.Friday + 7) % 7));

    /// <summary>
    /// Weekends in a row with a scan, counting back from this weekend if it has one, else from the last one while
    /// this weekend is still running, else 0 (the rule of the phone's old services/glow.ts).
    /// </summary>
    public static int Streak(IEnumerable<DateOnly> scanNights, DateOnly today)
    {
        var weekends = Weekends(scanNights);
        var anchor = FridayOf(today);
        DateOnly friday;
        if (weekends.Contains(anchor)) friday = anchor;
        else if (CityClock.IsWeekendNight(today) && weekends.Contains(anchor.AddDays(-7))) friday = anchor.AddDays(-7);
        else return 0;

        var streak = 0;
        while (weekends.Contains(friday))
        {
            streak++;
            friday = friday.AddDays(-7);
        }
        return streak;
    }

    /// <summary>The longest run of weekends in a row there has ever been.</summary>
    public static int BestStreak(IEnumerable<DateOnly> scanNights)
    {
        var weekends = Weekends(scanNights);
        var best = 0;
        foreach (var friday in weekends)
        {
            if (weekends.Contains(friday.AddDays(-7))) continue; // not the start of a run
            var run = 0;
            for (var f = friday; weekends.Contains(f); f = f.AddDays(7)) run++;
            best = Math.Max(best, run);
        }
        return best;
    }

    private static HashSet<DateOnly> Weekends(IEnumerable<DateOnly> nights) =>
        nights.Where(CityClock.IsWeekendNight).Select(FridayOf).ToHashSet();

    /// <summary>A scan counts as before midnight from 06:00 to 23:59 local: the evening part of its night.</summary>
    public static bool IsBeforeMidnight(DateTime local) => local.Hour >= CityClock.NightEndsAtHour;

    /// <summary>"One venue.\nOne good night." and so on.</summary>
    public static string Headline(int venues) => venues switch
    {
        <= 1 => "One venue.\nOne good night.",
        2 => "Two venues.\nOne long night.",
        _ => $"{CountWord(venues)} venues.\nOne big night."
    };

    /// <summary>"One venue", "Two venues", … for a push body.</summary>
    public static string VenueCount(int venues) => venues <= 1 ? "One venue" : $"{CountWord(venues)} venues";

    private static string CountWord(int n) => n switch
    {
        2 => "Two", 3 => "Three", 4 => "Four", 5 => "Five", 6 => "Six", 7 => "Seven", 8 => "Eight", 9 => "Nine",
        _ => n.ToString(System.Globalization.CultureInfo.InvariantCulture)
    };

    /// <summary>Points as written in the app: "1,240".</summary>
    public static string Points(int points) => points.ToString("#,0", System.Globalization.CultureInfo.InvariantCulture);
}
