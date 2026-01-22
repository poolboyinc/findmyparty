namespace FindMyParty.Bookings.API.Application.Common
{
    public interface ICurrentUserService
    {
        Guid UserId { get; }
        bool IsAuthenticated { get; }

    }
}
