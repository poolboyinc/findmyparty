namespace FindMyParty.Parties.API.Application.IntegrationEvents.EventBus
{
    public class PartyPublisherSettings
    {
        public string HostName { get; set; } = default!;
        public string UserName { get; set; } = default!;
        public string Password { get; set; } = default!;
        public string ExchangeName { get; set; } = default!;
    }
}
