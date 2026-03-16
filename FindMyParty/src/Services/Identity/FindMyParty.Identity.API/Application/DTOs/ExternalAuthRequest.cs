namespace FindMyParty.Identity.API.Application.DTOs;

public class ExternalAuthRequest
{
    public string Provider { get; set; } = string.Empty; // "google" | "apple"
    public string IdToken { get; set; } = string.Empty;
    public string? Name { get; set; }
}
