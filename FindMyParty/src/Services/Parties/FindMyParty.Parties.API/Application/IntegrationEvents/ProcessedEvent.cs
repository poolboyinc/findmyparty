namespace FindMyParty.Parties.API.Application.IntegrationEvents
{
    public class ProcessedEvent
    {
        public Guid Id { get; set; }
        public string EventType { get; set; } = default!;
        public DateTime ProcessedOnUtc { get; set; }
    }

}

