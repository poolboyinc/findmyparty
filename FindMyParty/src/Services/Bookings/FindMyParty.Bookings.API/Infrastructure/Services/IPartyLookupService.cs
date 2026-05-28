using FindMyParty.Bookings.API.Application.DTOs;

namespace FindMyParty.Bookings.API.Infrastructure.Services;

public interface IPartyLookupService
{
    Task<Dictionary<Guid, BookingPartyDto>> GetByIdsAsync(
        IEnumerable<Guid> ids,
        CancellationToken ct = default);
}
