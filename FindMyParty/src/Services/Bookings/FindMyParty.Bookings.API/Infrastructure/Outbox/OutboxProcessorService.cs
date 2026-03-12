using FindMyParty.Bookings.API.Application.IntegrationEvents.EventBus;
using FindMyParty.Bookings.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace FindMyParty.Bookings.API.Infrastructure.Outbox;

public class OutboxProcessorService(
    IOutboxSignal signal,
    IServiceScopeFactory scopeFactory) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // On startup, process anything left unprocessed from before shutdown/crash
        await ProcessPendingAsync(stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // Wait for a signal from CreateBookingCommandHandler,
                // but give up after 30 seconds and process anyway as a safety net
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                timeout.CancelAfter(TimeSpan.FromSeconds(30));

                await signal.WaitAsync(timeout.Token);
            }
            catch (OperationCanceledException) when (!stoppingToken.IsCancellationRequested)
            {
                // Fallback timer fired — not a real cancellation, just process and loop
            }

            if (stoppingToken.IsCancellationRequested) break;

            await ProcessPendingAsync(stoppingToken);
        }
    }

    private async Task ProcessPendingAsync(CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BookingsDbContext>();
        var eventBus = scope.ServiceProvider.GetRequiredService<IEventBus>();

        var messages = await db.OutboxMessages
            .Where(o => o.ProcessedOnUtc == null)
            .OrderBy(o => o.OccurredOnUtc)
            .Take(10)
            .ToListAsync(cancellationToken);

        if (messages.Count == 0) return;

        foreach (var message in messages)
        {
            try
            {
                var eventType = typeof(OutboxProcessorService).Assembly.GetType(message.Type);

                if (eventType == null) continue;

                var @event = JsonSerializer.Deserialize(message.Payload, eventType);

                if (@event != null)
                {
                    var publishMethod = typeof(IEventBus)
                        .GetMethod(nameof(IEventBus.PublishAsync))!
                        .MakeGenericMethod(eventType);

                    await (Task)publishMethod.Invoke(eventBus, [@event])!;
                }

                message.ProcessedOnUtc = DateTime.UtcNow;
            }
            catch (Exception ex)
            {
                // Log and continue — don't let one bad message block the rest
                Console.WriteLine($"Outbox error processing message {message.Id}: {ex}");
            }
        }

        await db.SaveChangesAsync(cancellationToken);
    }
}
