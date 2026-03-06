using FindMyParty.Bookings.API.Application.Commands;
using FindMyParty.Bookings.API.Application.Common;
using FindMyParty.Bookings.API.Infrastructure.Data;

namespace FindMyParty.Bookings.API.Application.Handlers;

public class ConfirmBookingCommandHandler(BookingsDbContext db, ICurrentUserService currentUser)
{
    public async Task Handle(ConfirmBookingCommand command)
    {
        var booking = await db.Bookings.FindAsync(command.BookingId)
            ?? throw new InvalidOperationException("Booking not found");

        if (booking.UserId != currentUser.UserId)
            throw new UnauthorizedAccessException();

        booking.Confirm();
        await db.SaveChangesAsync();
    }
}
