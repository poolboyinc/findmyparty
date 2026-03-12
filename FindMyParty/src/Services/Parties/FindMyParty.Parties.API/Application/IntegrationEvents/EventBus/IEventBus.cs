namespace FindMyParty.Parties.API.Application.IntegrationEvents.EventBus
{
    public interface IEventBus
    {
        Task PublishAsync<T>(T @event) where T : class;
    }
}
