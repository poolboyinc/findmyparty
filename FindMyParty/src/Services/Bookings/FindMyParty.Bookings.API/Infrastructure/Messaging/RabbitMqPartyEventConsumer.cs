using FindMyParty.Bookings.API.Application.IntegrationEvents;
using FindMyParty.Bookings.API.Application.IntegrationEvents.Handlers;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using System.Text;
using System.Text.Json;

namespace FindMyParty.Bookings.API.Infrastructure.Messaging;

public class RabbitMqPartyEventConsumer(
    IServiceScopeFactory scopeFactory,
    IConfiguration config) : BackgroundService
{
    private const string ExchangeName = "party.events";
    private const string QueueName = "bookings.party.cancelled";
    private const string DeadLetterQueueName = "bookings.party.cancelled.dlq";
    private const string DeadLetterExchange = "party.events.dlx";

    private IConnection? _connection;
    private IChannel? _channel;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var factory = new ConnectionFactory
        {
            HostName = config["RabbitMQ:HostName"] ?? "localhost",
            UserName = config["RabbitMQ:UserName"] ?? "guest",
            Password = config["RabbitMQ:Password"] ?? "guest",
            ClientProvidedName = "findmyparty-bookings-party-consumer"
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

        await _channel.ExchangeDeclareAsync(
            exchange: ExchangeName,
            type: ExchangeType.Topic,
            durable: true);

        await _channel.ExchangeDeclareAsync(
            exchange: DeadLetterExchange,
            type: ExchangeType.Fanout,
            durable: true);

        await _channel.QueueDeclareAsync(
            queue: DeadLetterQueueName,
            durable: true,
            exclusive: false,
            autoDelete: false);

        await _channel.QueueBindAsync(
            queue: DeadLetterQueueName,
            exchange: DeadLetterExchange,
            routingKey: "");

        var queueArgs = new Dictionary<string, object?>
        {
            { "x-dead-letter-exchange", DeadLetterExchange }
        };

        var queue = await _channel.QueueDeclareAsync(
            queue: QueueName,
            durable: true,
            exclusive: false,
            autoDelete: false,
            arguments: queueArgs);

        await _channel.QueueBindAsync(
            queue: queue.QueueName,
            exchange: ExchangeName,
            routingKey: nameof(PartyCancelledIntegrationEvent));

        var consumer = new AsyncEventingBasicConsumer(_channel);
        consumer.ReceivedAsync += OnMessageReceived;

        await _channel.BasicConsumeAsync(
            queue: queue.QueueName,
            autoAck: false,
            consumer: consumer);
    }

    private async Task OnMessageReceived(object sender, BasicDeliverEventArgs args)
    {
        using var scope = scopeFactory.CreateScope();
        var handler = scope.ServiceProvider
            .GetRequiredService<PartyCancelledIntegrationEventHandler>();

        try
        {
            var json = Encoding.UTF8.GetString(args.Body.ToArray());
            var @event = JsonSerializer.Deserialize<PartyCancelledIntegrationEvent>(json)!;

            await handler.Handle(@event, CancellationToken.None);

            await _channel!.BasicAckAsync(args.DeliveryTag, false);
        }
        catch
        {
            await _channel!.BasicNackAsync(args.DeliveryTag, false, requeue: false);
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        if (_channel != null) await _channel.CloseAsync();
        if (_connection != null) await _connection.CloseAsync();
    }
}
