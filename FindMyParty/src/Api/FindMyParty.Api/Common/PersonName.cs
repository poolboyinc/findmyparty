using FindMyParty.Api.Identity;

namespace FindMyParty.Api.Common;

/// <summary>How a person's name is shown.</summary>
public static class PersonName
{
    /// <summary>The name they chose, else their user name.</summary>
    public static string Display(ApplicationUser user) => Display(user.DisplayName, user.UserName);

    /// <summary>The same rule for code that read the two columns without loading the user.</summary>
    public static string Display(string? displayName, string? userName) =>
        !string.IsNullOrWhiteSpace(displayName) ? displayName.Trim()
        : !string.IsNullOrWhiteSpace(userName) ? userName
        : "Guest";

    /// <summary>"Vule Marković" becomes "Vule M."; a single name stays as it is.</summary>
    public static string Short(string name)
    {
        var parts = name.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return parts.Length switch
        {
            0 => "Guest",
            1 => parts[0],
            _ => $"{parts[0]} {FirstLetter(parts[^1])}."
        };
    }

    /// <summary>The first letter, upper-case: "V" for "vule".</summary>
    public static string Initial(string name)
    {
        var trimmed = name.Trim();
        return trimmed.Length == 0 ? "?" : FirstLetter(trimmed);
    }

    // A letter outside the basic plane takes two chars; cutting it in half would print a broken character.
    private static string FirstLetter(string word) =>
        System.Globalization.StringInfo.GetNextTextElement(word).ToUpperInvariant();
}
