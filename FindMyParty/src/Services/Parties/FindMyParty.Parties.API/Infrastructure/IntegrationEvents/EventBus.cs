namespace FindMyParty.Parties.API.Infrastructure.IntegrationEvents
{
    public class InMemoryEventBus : IEventBus
    {
        public Task PublishAsync<T>(T @event)
            where T : class
        {
            Console.WriteLine($"[Parties] Event published: {@event.GetType().Name}");
            return Task.CompletedTask;
        }
    }
}
