namespace FindMyParty.Identity.API.Application.DTOs
{
    public class RefreshTokenRequest
    {
        public string UserId { get; set; } = string.Empty;
        public string RefreshToken { get; set; } = string.Empty;
    }
}
