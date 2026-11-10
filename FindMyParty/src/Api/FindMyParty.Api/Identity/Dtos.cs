using System.ComponentModel.DataAnnotations;

namespace FindMyParty.Api.Identity;

public record RegisterRequest(string UserName, string Email, string Password);
public record LoginRequest(string Email, string Password);
public record LoginResponse(string AccessToken, string RefreshToken);
public record RefreshTokenRequest(string? UserId, string RefreshToken);
public record LogoutRequest(string RefreshToken);
public record ExternalAuthRequest(string Provider, string IdToken, string? Name);
public record AssignRoleRequest(string Role);
public record UpdateSubscriptionRequest(string Subscription);

public record SetVenueProfileRequest(
    [Required, StringLength(200)] string VenueName,
    [Required, StringLength(500)] string Address,
    [Range(-90, 90)] double Latitude,
    [Range(-180, 180)] double Longitude);

public record UpdateMyVenueProfileRequest(
    [Required, StringLength(120)] string VenueName,
    TimeOnly? WorkingHoursOpen,
    TimeOnly? WorkingHoursClose,
    [StringLength(50)] string? WorkingDays);

public record VenueProfileDto(
    string VenueId,
    string VenueName,
    string Address,
    double Latitude,
    double Longitude,
    TimeOnly? WorkingHoursOpen,
    TimeOnly? WorkingHoursClose,
    string? WorkingDays);
