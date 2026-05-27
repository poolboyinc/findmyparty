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
        await SafeProcessAsync(stoppingToken);

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

            await SafeProcessAsync(stoppingToken);
        }
    }

    /// <summary>
    /// Wraps <see cref="ProcessPendingAsync"/> so a transient DB/broker failure
    /// can never throw out of <see cref="ExecuteAsync"/>. Previously an
    /// unhandled exception here (e.g. a Postgres connection timeout on the
    /// query at the top of ProcessPendingAsync) propagated out and, with the
    /// host's default StopHost behavior, shut down the entire service. Now we
    /// log, back off, and let the next signal or the 30s fallback timer retry —
    /// the DB connection recovers on a later attempt.
    /// </summary>
    private async Task SafeProcessAsync(CancellationToken stoppingToken)
    {
        try
        {
            await ProcessPendingAsync(stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Genuine shutdown — let it bubble so the loop exits cleanly.
            throw;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Outbox] Processing failed (will retry): {ex.Message}");
            try
            {
                // Brief backoff so a persistent failure doesn't hot-loop.
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                // Shutting down during backoff — ignore.
            }
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
