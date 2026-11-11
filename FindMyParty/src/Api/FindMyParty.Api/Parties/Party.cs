namespace FindMyParty.Api.Parties;

public enum PartyStatus
{
    Draft = 0,
    Published = 1,
    Cancelled = 2,
    /// <summary>No longer set. "Sold out" is derived from TicketsSold and Capacity. Kept so stored values stay readable.</summary>
    SoldOut = 3
}

public class Party
{
    public Guid Id { get; private set; }
    public Guid HostId { get; private set; }
    /// <summary>The host's venue at the time the party was created.</summary>
    public Guid? VenueId { get; private set; }
    public string Title { get; private set; } = null!;
    public string Description { get; private set; } = null!;
    public decimal Price { get; private set; }
    public int Capacity { get; private set; }
    /// <summary>Spots held by active bookings. Changed only by the booking code, atomically in the database.</summary>
    public int TicketsSold { get; private set; }
    public DateTime StartsAt { get; private set; }
    public DateTime EndsAt { get; private set; }
    public double Latitude { get; private set; }
    public double Longitude { get; private set; }
    public string? ImageUrl { get; private set; }
    public string? Genre { get; private set; }
    public string? PerformerName { get; private set; }
    public string? PerformerType { get; private set; }
    /// <summary>Set by FindMyParty, never by the host.</summary>
    public bool Featured { get; private set; }
    public PartyStatus Status { get; private set; }
    public bool IsDeleted { get; private set; }
    /// <summary>Youngest age let in: 16, 18 or 21; null for no limit.</summary>
    public int? AgeLimit { get; private set; }
    /// <summary>How long after the start a pass is held for its guest.</summary>
    public int HoldMinutes { get; private set; } = DefaultHoldMinutes;

    public const int DefaultHoldMinutes = 90;

    protected Party() { }

    public Party(Guid hostId, Guid? venueId, PartyRequest r)
    {
        Id = Guid.NewGuid();
        HostId = hostId;
        VenueId = venueId;
        Status = PartyStatus.Draft;
        Apply(r);
    }

    public void Update(PartyRequest r)
    {
        if (Status != PartyStatus.Draft) throw new InvalidOperationException("Only draft parties can be edited.");
        Apply(r);
    }

    private void Apply(PartyRequest r)
    {
        Title = r.Title;
        Description = r.Description;
        Price = r.Price;
        Capacity = r.Capacity;
        StartsAt = r.StartsAt;
        EndsAt = r.EndsAt;
        Latitude = r.Latitude;
        Longitude = r.Longitude;
        ImageUrl = r.ImageUrl;
        Genre = r.Genre;
        PerformerName = r.PerformerName;
        PerformerType = r.PerformerType;
    }

    public void Publish()
    {
        if (Status != PartyStatus.Draft) throw new InvalidOperationException("Party must be draft to publish.");
        if (StartsAt <= DateTime.UtcNow) throw new InvalidOperationException("Party must start in the future.");
        Status = PartyStatus.Published;
    }

    /// <summary>Publishes without the "must start in the future" rule. For demo data, which needs parties that are already on.</summary>
    internal void PublishNow() => Status = PartyStatus.Published;

    public void Cancel() => Status = PartyStatus.Cancelled;
    public void Delete() => IsDeleted = true;
    public void SetImageUrl(string? imageUrl) => ImageUrl = imageUrl;
}
