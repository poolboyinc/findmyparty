using FindMyParty.Parties.API.Domain.Enums;
using FindMyParty.Parties.API.Domain.Events;

namespace FindMyParty.Parties.API.Domain.Entities
{
    public class Party
    {
        private readonly List<IDomainEvent> _domainEvents = new();

        public Guid Id { get; private set; }
        public Guid HostId { get; private set; }

        public string Title { get; private set; } = null!;
        public string Description { get; private set; } = null!;

        public decimal Price { get; private set; }
        public int Capacity { get; private set; }
        public int TicketsSold { get; private set; }

        public DateTime StartsAt { get; private set; }
        public DateTime EndsAt { get; private set; }

        public double Latitude { get; private set; }
        public double Longitude { get; private set; }

        public string? ImageUrl { get; private set; }

        public PartyStatus Status { get; private set; }
        public bool IsDeleted { get; private set; }

        public IReadOnlyCollection<IDomainEvent> DomainEvents => _domainEvents;

        protected Party() { }

        public Party(
            Guid hostId,
            string title,
            string description,
            decimal price,
            int capacity,
            DateTime startsAt,
            DateTime endsAt,
            double latitude,
            double longitude,
            string? imageUrl = null)
        {
            Id = Guid.NewGuid();
            HostId = hostId;
            Title = title;
            Description = description;
            Price = price;
            Capacity = capacity;
            StartsAt = startsAt;
            EndsAt = endsAt;
            Latitude = latitude;
            Longitude = longitude;
            ImageUrl = imageUrl;
            Status = PartyStatus.Draft;
        }

        public void Publish()
        {
            if (Status != PartyStatus.Draft)
                throw new InvalidOperationException("Party must be draft to publish.");

            if (StartsAt <= DateTime.UtcNow)
                throw new InvalidOperationException("Party must start in the future.");

            Status = PartyStatus.Published;
            _domainEvents.Add(new PartyPublishedDomainEvent(Id));
        }

        public void Update(string title, string description, decimal price, int capacity, DateTime startsAt, DateTime endsAt, double latitude, double longitude, string? imageUrl = null)
        {
            if (Status != PartyStatus.Draft)
                throw new InvalidOperationException("Only draft parties can be edited.");

            Title = title;
            Description = description;
            Price = price;
            Capacity = capacity;
            StartsAt = startsAt;
            EndsAt = endsAt;
            Latitude = latitude;
            Longitude = longitude;
            ImageUrl = imageUrl;
        }

        public void Cancel()
        {
            Status = PartyStatus.Cancelled;
            _domainEvents.Add(new PartyCancelledDomainEvent(Id));
        }

        public void ReserveTicket()
        {
            if (TicketsSold >= Capacity)
                throw new InvalidOperationException("Party is sold out.");

            TicketsSold++;
        }

        public void ReserveCapacity(int tickets)
        {
            if (TicketsSold + tickets > Capacity)
                throw new InvalidOperationException("Capacity exceeded");

            TicketsSold += tickets;
        }


        public void Delete()
        {
            IsDeleted = true;
        }

        public void SetImageUrl(string? imageUrl)
        {
            ImageUrl = imageUrl;
        }

        public void ClearDomainEvents() => _domainEvents.Clear();

        public void AddTicketsSold(int count)
        {
            if (count <= 0)
                throw new InvalidOperationException();

            TicketsSold += count;
        }

        public void MarkSoldOut()
        {
            Status = PartyStatus.SoldOut;
        }

    }
}
