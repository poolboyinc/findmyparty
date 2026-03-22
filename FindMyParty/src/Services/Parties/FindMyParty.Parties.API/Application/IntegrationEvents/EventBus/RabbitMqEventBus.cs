using Microsoft.Extensions.Options;
using RabbitMQ.Client;
using System.Text;
using System.Text.Json;

namespace FindMyParty.Parties.API.Application.IntegrationEvents.EventBus
{
    public sealed class RabbitMqEventBus : IEventBus, IAsyncDisposable
    {
        private readonly PartyPublisherSettings _settings;
        private readonly SemaphoreSlim _initLock = new(1, 1);
        private IConnection? _connection;
        private IChannel? _channel;

        public RabbitMqEventBus(IOptions<PartyPublisherSettings> options)
        {
            _settings = options.Value;
        }

        private async Task EnsureConnectedAsync()
        {
            if (_channel != null) return;

            await _initLock.WaitAsync();
            try
            {
                if (_channel != null) return;

                var factory = new ConnectionFactory
                {
                    HostName = _settings.HostName,
                    UserName = _settings.UserName,
                    Password = _settings.Password,
                    ClientProvidedName = "findmyparty-parties-eventbus"
                };

                _connection = await factory.CreateConnectionAsync();
                _channel = await _connection.CreateChannelAsync();

                await _channel.ExchangeDeclareAsync(
                    exchange: _settings.ExchangeName,
                    type: ExchangeType.Topic,
                    durable: true,
                    autoDelete: false,
                    arguments: null);
            }
            finally
            {
                _initLock.Release();
            }
        }

        public async Task PublishAsync<T>(T @event) where T : class
        {
            await EnsureConnectedAsync();

            var body = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(@event));

            var properties = new BasicProperties
            {
                DeliveryMode = DeliveryModes.Persistent
            };

            await _channel!.BasicPublishAsync(
                exchange: _settings.ExchangeName,
                routingKey: typeof(T).Name,
                mandatory: false,
                basicProperties: properties,
                body: body);
        }

        public async ValueTask DisposeAsync()
        {
            if (_channel != null)
            {
                await _channel.CloseAsync();
                await _channel.DisposeAsync();
            }
            if (_connection != null)
            {
                await _connection.CloseAsync();
                await _connection.DisposeAsync();
            }
        }
    }
}
