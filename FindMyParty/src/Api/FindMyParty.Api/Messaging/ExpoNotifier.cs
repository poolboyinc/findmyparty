using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using System.Threading.Channels;
using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Messaging;

/// <summary>Pushes waiting to go out. In memory: a restart loses what was not sent yet, which is fine for pushes.</summary>
public class PushQueue
{
    public const int Capacity = 10_000;

    private readonly Channel<Push> _channel = Channel.CreateBounded<Push>(new BoundedChannelOptions(Capacity)
    {
        FullMode = BoundedChannelFullMode.DropOldest,
        SingleReader = false,
        SingleWriter = false,
    });

    public bool Enqueue(Push push) => _channel.Writer.TryWrite(push);
    public bool TryDequeue(out Push push) => _channel.Reader.TryRead(out push!);
    public IAsyncEnumerable<Push> ReadAllAsync(CancellationToken ct) => _channel.Reader.ReadAllAsync(ct);
}

/// <summary>The app's INotifier: queues the push and returns at once; PushWorker sends it through Expo.</summary>
public class ExpoNotifier(PushQueue queue, IConfiguration config, ILogger<ExpoNotifier> logger) : INotifier
{
    public Task SendAsync(Push push, CancellationToken ct = default)
    {
        try
        {
            if (config.GetValue("Push:Enabled", true) && push.UserIds.Count > 0) queue.Enqueue(push);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Could not queue push {Type}", push.Type);
        }
        return Task.CompletedTask;
    }
}

/// <summary>
/// Sends one push to every device of its users through Expo's push API, 100 messages per request.
/// Users who switched the push's category off are skipped; tokens Expo calls DeviceNotRegistered are removed.
/// </summary>
public class ExpoPushSender(AppDbContext db, IHttpClientFactory http, IConfiguration config, ILogger<ExpoPushSender> logger)
{
    public const string HttpClientName = "expo-push";
    public const string SendUrl = "https://exp.host/--/api/v2/push/send";
    public const int BatchSize = 100;

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    private record Message(string To, string Title, string? Body, JsonObject Data, string Sound = "default");
    private record TicketDetails(string? Error);
    private record Ticket(string? Status, string? Message, TicketDetails? Details);
    private record Tickets(List<Ticket>? Data);

    public async Task DeliverAsync(Push push, CancellationToken ct)
    {
        if (!config.GetValue("Push:Enabled", true)) return;

        var ids = push.UserIds.Distinct().Select(id => id.ToString()).ToList();
        var users = db.Users.AsNoTracking().Where(u => ids.Contains(u.Id));
        users = push.Category switch
        {
            NotifyCategory.Venues => users.Where(u => u.NotifyVenues),
            NotifyCategory.Friends => users.Where(u => u.NotifyFriends),
            NotifyCategory.Nights => users.Where(u => u.NotifyNights),
            _ => users,
        };
        var allowed = (await users.Select(u => u.Id).ToListAsync(ct)).Select(Guid.Parse).ToList();
        if (allowed.Count == 0) return;

        var tokens = await db.Set<PushDevice>().AsNoTracking().Where(d => allowed.Contains(d.UserId))
            .OrderBy(d => d.Id).Select(d => d.ExpoToken).ToListAsync(ct);
        if (tokens.Count == 0) return;

        var data = DataOf(push);
        var dead = new List<string>();
        foreach (var batch in tokens.Chunk(BatchSize))
            dead.AddRange(await SendBatchAsync(push, batch, data, ct));

        if (dead.Count > 0)
        {
            await db.Set<PushDevice>().Where(d => dead.Contains(d.ExpoToken)).ExecuteDeleteAsync(ct);
            logger.LogInformation("Removed {Count} push tokens Expo no longer knows", dead.Count);
        }
    }

    /// <summary>The push's data as a JSON object, camelCase, always with `type`.</summary>
    private static JsonObject DataOf(Push push)
    {
        var data = push.Data is null ? null : JsonSerializer.SerializeToNode(push.Data, push.Data.GetType(), Json) as JsonObject;
        data ??= new JsonObject();
        data["type"] = push.Type;
        return data;
    }

    /// <summary>Sends one request. Returns the tokens Expo said are dead; a failure is logged and returns none.</summary>
    private async Task<List<string>> SendBatchAsync(Push push, string[] batch, JsonObject data, CancellationToken ct)
    {
        var body = string.IsNullOrEmpty(push.Body) ? null : push.Body;
        var messages = batch.Select(token => new Message(token, push.Title, body, (JsonObject)data.DeepClone())).ToList();
        using var request = new HttpRequestMessage(HttpMethod.Post, SendUrl) { Content = JsonContent.Create(messages, options: Json) };
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        if (config["Push:AccessToken"] is { Length: > 0 } accessToken)
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        try
        {
            using var response = await http.CreateClient(HttpClientName).SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Expo refused push {Type} to {Count} devices: {Status}", push.Type, batch.Length, (int)response.StatusCode);
                return [];
            }

            var tickets = (await response.Content.ReadFromJsonAsync<Tickets>(Json, ct))?.Data ?? [];
            var dead = new List<string>();
            for (var i = 0; i < Math.Min(tickets.Count, batch.Length); i++)
            {
                if (tickets[i].Status != "error") continue;
                if (tickets[i].Details?.Error == "DeviceNotRegistered") dead.Add(batch[i]);
                else logger.LogWarning("Expo could not take push {Type}: {Error} {Message}", push.Type, tickets[i].Details?.Error, tickets[i].Message);
            }
            return dead;
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            logger.LogWarning(ex, "Could not reach Expo for push {Type} to {Count} devices", push.Type, batch.Length);
            return [];
        }
    }
}

/// <summary>
/// Sends queued pushes in the background, one after another. Not started in environment Testing:
/// tests call RunOnceAsync, which sends what is queued now.
/// </summary>
public class PushWorker(PushQueue queue, IServiceScopeFactory scopes, IHostEnvironment environment, ILogger<PushWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (environment.IsEnvironment("Testing")) return;
        try
        {
            await foreach (var push in queue.ReadAllAsync(stoppingToken))
                await DeliverAsync(push, stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }
    }

    /// <summary>Sends every push that is waiting. Returns how many were taken from the queue.</summary>
    public async Task<int> RunOnceAsync(CancellationToken ct = default)
    {
        var count = 0;
        while (queue.TryDequeue(out var push))
        {
            await DeliverAsync(push, ct);
            count++;
        }
        return count;
    }

    private async Task DeliverAsync(Push push, CancellationToken ct)
    {
        try
        {
            await using var scope = scopes.CreateAsyncScope();
            await scope.ServiceProvider.GetRequiredService<ExpoPushSender>().DeliverAsync(push, ct);
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            logger.LogError(ex, "Push {Type} was not sent", push.Type);
        }
    }
}
