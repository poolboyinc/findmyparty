using FindMyParty.Bookings.API.Application.Commands;
using FindMyParty.Bookings.API.Domain.Aggregates;
using FindMyParty.Bookings.API.Infrastructure.Data;

namespace FindMyParty.Bookings.API.Application.Handlers
{
    public class CreateBookingCommandHandler
    {
        private readonly BookingsDbContext _db;

        public CreateBookingCommandHandler(BookingsDbContext db)
        {
            _db = db;
        }

        public async Task<Guid> Handle(CreateBookingCommand command)
        {
            // Later: call Parties.API or cache to verify availability
            var booking = new Booking(
                command.UserId,
                command.PartyId,
                command.TicketCount,
                pricePerTicket: 50 // placeholder, later from Parties
            );

            _db.Bookings.Add(booking);
            await _db.SaveChangesAsync();

            return booking.Id;
        }
    }
}
