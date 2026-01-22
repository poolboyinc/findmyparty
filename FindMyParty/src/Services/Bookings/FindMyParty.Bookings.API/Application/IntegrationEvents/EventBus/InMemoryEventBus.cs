namespace FindMyParty.Bookings.API.Application.IntegrationEvents.EventBus
{
    public class InMemoryEventBus : IEventBus
    {
        public Task PublishAsync<T>(T @event)
            where T : class
        {
            // Later: RabbitMQ
            Console.WriteLine($"Event published: {@event.GetType().Name}");
            return Task.CompletedTask;
        }
    }
}
