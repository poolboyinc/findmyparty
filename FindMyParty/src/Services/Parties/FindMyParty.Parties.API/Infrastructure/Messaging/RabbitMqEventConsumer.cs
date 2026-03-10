using FindMyParty.Parties.API.Application.IntegrationEvents;
using FindMyParty.Parties.API.Application.IntegrationEvents.Handlers;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using System.Text;
using System.Text.Json;

namespace FindMyParty.Parties.API.Infrastructure.Messaging
{
    public class RabbitMqEventConsumer(
          IServiceScopeFactory scopeFactory,
          IConfiguration config) : BackgroundService
    {
        private IConnection? _connection;
        private IChannel? _channel;

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var factory = new ConnectionFactory
            {
                HostName = config["RabbitMQ:HostName"],
                UserName = config["RabbitMQ:UserName"],
                Password = config["RabbitMQ:Password"],
                ClientProvidedName = "findmyparty-parties-consumer"
            };

            _connection = await factory.CreateConnectionAsync(stoppingToken);
            _channel = await _connection.CreateChannelAsync();

            // Main exchange for booking events
            await _channel.ExchangeDeclareAsync(
                exchange: "booking.events",
                type: ExchangeType.Topic,
                durable: true);

            // Dead letter exchange — failed messages land here instead of requeueing forever
            await _channel.ExchangeDeclareAsync(
                exchange: "booking.events.dlx",
                type: ExchangeType.Fanout,
                durable: true);

            await _channel.QueueDeclareAsync(
                queue: "parties.booking.created.dlq",
                durable: true,
                exclusive: false,
                autoDelete: false);

            await _channel.QueueBindAsync(
                queue: "parties.booking.created.dlq",
                exchange: "booking.events.dlx",
                routingKey: "");

            // Main queue — on failure, messages go to DLX rather than requeuing
            var queueArgs = new Dictionary<string, object?>
            {
                { "x-dead-letter-exchange", "booking.events.dlx" }
            };

            var queue = await _channel.QueueDeclareAsync(
                queue: "parties.booking.created",
                durable: true,
                exclusive: false,
                autoDelete: false,
                arguments: queueArgs);

            await _channel.QueueBindAsync(
                queue: queue.QueueName,
                exchange: "booking.events",
                routingKey: "BookingCreatedIntegrationEvent");

            var consumer = new AsyncEventingBasicConsumer(_channel);
            consumer.ReceivedAsync += OnMessageReceived;

            await _channel.BasicConsumeAsync(
                queue: queue.QueueName,
                autoAck: false,
                consumer: consumer);
        }

        private async Task OnMessageReceived(
            object sender,
            BasicDeliverEventArgs args)
        {
            using var scope = scopeFactory.CreateScope();
            var handler =
                scope.ServiceProvider
                     .GetRequiredService<BookingCreatedEventHandler>();

            try
            {
                var json = Encoding.UTF8.GetString(args.Body.ToArray());
                var @event = JsonSerializer.Deserialize<BookingCreatedIntegrationEvent>(json)!;

                await handler.Handle(@event, CancellationToken.None);

                await _channel!.BasicAckAsync(args.DeliveryTag, false);
            }
            catch
            {
                // requeue: false → message routed to DLQ instead of cycling forever
                await _channel!.BasicNackAsync(
                    args.DeliveryTag,
                    false,
                    requeue: false);
            }
        }

        public override async Task StopAsync(CancellationToken cancellationToken)
        {
            if (_channel != null) await _channel.CloseAsync();
            if (_connection != null) await _connection.CloseAsync();
        }
    }
}
