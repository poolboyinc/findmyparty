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
            var eventType = Type.GetType(
                $"FindMyParty.Bookings.API.Application.IntegrationEvents.Events.{message.Type}");

            if (eventType == null) continue;

            var @event = JsonSerializer.Deserialize(message.Payload, eventType);

            if (@event != null)
            {
                await eventBus.PublishAsync(@event);
            }

            message.ProcessedOnUtc = DateTime.UtcNow;
        }

        await dbContext.SaveChangesAsync(context.CancellationToken);
    }
}