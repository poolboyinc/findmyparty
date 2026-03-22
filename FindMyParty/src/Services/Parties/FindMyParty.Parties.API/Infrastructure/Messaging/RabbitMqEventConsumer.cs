using FindMyParty.Parties.API.Application.IntegrationEvents;
using FindMyParty.Parties.API.Application.IntegrationEvents.Handlers;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using System.Text;
using System.Text.Json;

// Routing key constants — must match what the Bookings service publishes
file static class RoutingKeys
{
    public const string BookingCreated = "BookingCreatedIntegrationEvent";
    public const string BookingCancelled = "BookingCancelledIntegrationEvent";
}

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
                HostName = config["RabbitMQ:HostName"] ?? "localhost",
                UserName = config["RabbitMQ:UserName"] ?? "guest",
                Password = config["RabbitMQ:Password"] ?? "guest",
                ClientProvidedName = "findmyparty-parties-consumer"
            };

            // Retry connection with backoff — RabbitMQ may not be ready yet
            for (var attempt = 1; ; attempt++)
            {
                try
                {
                    _connection = await factory.CreateConnectionAsync(stoppingToken);
                    _channel = await _connection.CreateChannelAsync();
                    break;
                }
                catch when (!stoppingToken.IsCancellationRequested)
                {
                    var delay = Math.Min(attempt * 5, 30);
                    Console.WriteLine($"[RabbitMQ Consumer] Connection attempt {attempt} failed. Retrying in {delay}s...");
                    await Task.Delay(TimeSpan.FromSeconds(delay), stoppingToken);
                }
            }

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

            // Main queues — on failure, messages go to DLX rather than requeuing
            var queueArgs = new Dictionary<string, object?>
            {
                { "x-dead-letter-exchange", "booking.events.dlx" }
            };

            // Queue: booking created
            var createdQueue = await _channel.QueueDeclareAsync(
                queue: "parties.booking.created",
                durable: true,
                exclusive: false,
                autoDelete: false,
                arguments: queueArgs);

            await _channel.QueueBindAsync(
                queue: createdQueue.QueueName,
                exchange: "booking.events",
                routingKey: RoutingKeys.BookingCreated);

            // Queue: booking cancelled
            var cancelledQueue = await _channel.QueueDeclareAsync(
                queue: "parties.booking.cancelled",
                durable: true,
                exclusive: false,
                autoDelete: false,
                arguments: queueArgs);

            await _channel.QueueBindAsync(
                queue: cancelledQueue.QueueName,
                exchange: "booking.events",
                routingKey: RoutingKeys.BookingCancelled);

            var consumer = new AsyncEventingBasicConsumer(_channel);
            consumer.ReceivedAsync += OnMessageReceived;

            await _channel.BasicConsumeAsync(
                queue: createdQueue.QueueName,
                autoAck: false,
                consumer: consumer);

            await _channel.BasicConsumeAsync(
                queue: cancelledQueue.QueueName,
                autoAck: false,
                consumer: consumer);
        }

        private async Task OnMessageReceived(
            object sender,
            BasicDeliverEventArgs args)
        {
            using var scope = scopeFactory.CreateScope();

            try
            {
                var json = Encoding.UTF8.GetString(args.Body.ToArray());
                var routingKey = args.RoutingKey;

                if (routingKey == RoutingKeys.BookingCreated)
                {
                    var @event = JsonSerializer.Deserialize<BookingCreatedIntegrationEvent>(json)!;
                    await scope.ServiceProvider
                        .GetRequiredService<BookingCreatedEventHandler>()
                        .Handle(@event, CancellationToken.None);
                }
                else if (routingKey == RoutingKeys.BookingCancelled)
                {
                    var @event = JsonSerializer.Deserialize<BookingCancelledIntegrationEvent>(json)!;
                    await scope.ServiceProvider
                        .GetRequiredService<BookingCancelledEventHandler>()
                        .Handle(@event, CancellationToken.None);
                }

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
