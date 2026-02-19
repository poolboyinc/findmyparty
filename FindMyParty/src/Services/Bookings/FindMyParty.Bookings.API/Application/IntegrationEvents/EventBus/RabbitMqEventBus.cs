using Microsoft.Extensions.Options;
using RabbitMQ.Client;
using System.Text;
using System.Text.Json;

namespace FindMyParty.Bookings.API.Application.IntegrationEvents.EventBus;

public sealed class RabbitMqEventBus : IEventBus, IAsyncDisposable
{
    private readonly IConnection _connection;
    private readonly IChannel _channel;
    private readonly string _exchangeName;

    public RabbitMqEventBus(IOptions<RabbitMqSettings> options)
    {
        _exchangeName = options.Value.ExchangeName;

        var factory = new ConnectionFactory
        {
            HostName = options.Value.HostName,
            UserName = options.Value.UserName,
            Password = options.Value.Password,
            ClientProvidedName = "findmyparty-bookings-eventbus"
        };

        _connection = factory.CreateConnectionAsync().GetAwaiter().GetResult();
        _channel = _connection.CreateChannelAsync().GetAwaiter().GetResult();

        _channel.ExchangeDeclareAsync(
            exchange: _exchangeName,
            type: ExchangeType.Topic,
            durable: true,
            autoDelete: false,
            arguments: null
        ).GetAwaiter().GetResult();
    }

    public async Task PublishAsync<T>(T @event) where T : class
    {
        var body = Encoding.UTF8.GetBytes(
            JsonSerializer.Serialize(@event));

        var properties = new BasicProperties
        {
            DeliveryMode = DeliveryModes.Persistent
        };

        await _channel.BasicPublishAsync(
            exchange: _exchangeName,
            routingKey: typeof(T).Name,
            mandatory: false,
            basicProperties: properties,
            body: body);
    }

    public async ValueTask DisposeAsync()
    {
        await _channel.CloseAsync();
        await _connection.CloseAsync();
        await _channel.DisposeAsync();
        await _connection.DisposeAsync();
    }
}
