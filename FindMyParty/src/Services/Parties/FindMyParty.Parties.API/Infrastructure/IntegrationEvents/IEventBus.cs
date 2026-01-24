namespace FindMyParty.Parties.API.Infrastructure.IntegrationEvents
{
    public interface IEventBus
    {
        Task PublishAsync<T>(T @event)
            where T : class;
    }
}
