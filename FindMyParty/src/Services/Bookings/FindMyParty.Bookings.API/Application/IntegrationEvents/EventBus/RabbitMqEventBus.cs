using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;
using System.Text;
using System.Text.Json;

namespace FindMyParty.Bookings.API.Application.IntegrationEvents.EventBus;

public class RabbitMqEventBus : IEventBus, IDisposable
{
    private readonly IConnection connection;
    private readonly IModel channel;
    private readonly string exchangeName;

    public RabbitMqEventBus(IOptions<RabbitMqSettings> settings)
    {
        exchangeName = settings.Value.ExchangeName;

        var factory = new ConnectionFactory
        {
            HostName = settings.Value.HostName,
            UserName = settings.Value.UserName,
            Password = settings.Value.Password,
            DispatchConsumersAsync = true
        };

        connection = factory.CreateConnection();
        channel = connection.CreateModel();

        channel.ExchangeDeclare(
            exchange: exchangeName,
            type: ExchangeType.Topic,
            durable: true,
            autoDelete: false);
    }

    public Task PublishAsync<T>(T @event) where T : class
    {
        var eventName = typeof(T).Name;
        var body = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(@event));

        var properties = channel.CreateBasicProperties();
        properties.DeliveryMode = 2; // persistent

        channel.BasicPublish(
            exchange: exchangeName,
            routingKey: eventName,
            basicProperties: properties,
            body: body);

        return Task.CompletedTask;
    }

    public void Dispose()
    {
        channel?.Dispose();
        connection?.Dispose();
    }
}

