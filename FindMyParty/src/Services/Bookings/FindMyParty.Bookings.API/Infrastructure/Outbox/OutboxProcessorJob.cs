using FindMyParty.Bookings.API.Application.IntegrationEvents.EventBus;
using FindMyParty.Bookings.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Quartz;
using System.Text.Json;

namespace FindMyParty.Bookings.API.Infrastructure.Outbox;

[DisallowConcurrentExecution] 
public class OutboxProcessorJob(
    BookingsDbContext dbContext,
    IEventBus eventBus) : IJob
{
    public async Task Execute(IJobExecutionContext context)
    {
        var messages = await dbContext.OutboxMessages
            .Where(o => o.ProcessedOnUtc == null)
            .OrderBy(o => o.OccurredOnUtc)
            .Take(10)
            .ToListAsync(context.CancellationToken);

        if (messages.Count == 0) return;

        foreach (var message in messages)
        {
            try
            {
                var assembly = typeof(OutboxProcessorJob).Assembly;

                var eventType = assembly.GetType(message.Type);

                Console.WriteLine($"Resolved Type: {eventType}");

                if (eventType == null)
                {
                    Console.WriteLine($"Could not resolve type: {message.Type}");
                    continue;
                }

                var @event = JsonSerializer.Deserialize(message.Payload, eventType);

                if (@event != null)
                {
                    Console.WriteLine("Publishing event...");
                    var publishMethod = typeof(IEventBus)
                        .GetMethod(nameof(IEventBus.PublishAsync))!
                        .MakeGenericMethod(eventType);
                    await (Task)publishMethod.Invoke(eventBus, [@event])!;
                    Console.WriteLine("Published successfully.");
                }

                message.ProcessedOnUtc = DateTime.UtcNow;
            }
            catch (Exception ex)
            {
                Console.WriteLine("OUTBOX ERROR:");
                Console.WriteLine(ex.ToString());
            }
        }

        await dbContext.SaveChangesAsync(context.CancellationToken);
    }
}