using FindMyParty.Bookings.API.Domain.Enums;

namespace FindMyParty.Bookings.API.Domain.Aggregates
{
    public class Booking
    {
        public Guid Id { get; private set; }
        public Guid UserId { get; private set; }
        public Guid PartyId { get; private set; }

        public int TicketCount { get; private set; }
        public decimal TotalPrice { get; private set; }

        public BookingStatus Status { get; private set; }
        public DateTime CreatedAt { get; private set; }

        protected Booking() { }

        public Booking(Guid userId, Guid partyId, int ticketCount, decimal pricePerTicket)
        {
            if (ticketCount <= 0)
                throw new ArgumentException("Ticket count must be positive");

            Id = Guid.NewGuid();
            UserId = userId;
            PartyId = partyId;
            TicketCount = ticketCount;
            TotalPrice = ticketCount * pricePerTicket;
            Status = BookingStatus.Pending;
            CreatedAt = DateTime.UtcNow;
        }

        public void Confirm()
        {
            if (Status != BookingStatus.Pending)
                throw new InvalidOperationException("Only pending bookings can be confirmed");

            Status = BookingStatus.Confirmed;
        }

        public void Cancel()
        {
            if (Status == BookingStatus.Cancelled)
                return;

            Status = BookingStatus.Cancelled;
        }
    }
}
