
namespace FindMyParty.Identity.API.Application.DTOs;

public class RegisterRequest
{
    public string UserName { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string Password { get; init; } = string.Empty;
}