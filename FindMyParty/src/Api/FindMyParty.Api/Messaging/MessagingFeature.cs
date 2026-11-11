using FindMyParty.Api.Common;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace FindMyParty.Api.Messaging;

public class MessagingFeature : IFeature
{
    public void Add(IServiceCollection services, IConfiguration config)
    {
        // Push: queued in memory, sent by PushWorker through Expo. Replaces the default NullNotifier
        // (TryAdd: a notifier registered before the features, as a test host does, still wins).
        services.AddSingleton<PushQueue>();
        services.TryAddSingleton<INotifier, ExpoNotifier>();
        services.AddScoped<ExpoPushSender>();
        services.AddSingleton<PushWorker>();
        services.AddHostedService(sp => sp.GetRequiredService<PushWorker>());
        services.AddHttpClient(ExpoPushSender.HttpClientName, c => c.Timeout = TimeSpan.FromSeconds(20));

        // Mail: through the mail API only when a key is set; otherwise the default sender logs.
        services.AddHttpClient(ResendEmailSender.HttpClientName, c => c.Timeout = TimeSpan.FromSeconds(20));
        if (!string.IsNullOrWhiteSpace(config["Email:ApiKey"]))
            services.TryAddSingleton<IEmailSender, ResendEmailSender>();

        services.AddScoped<PasswordResetService>();
        services.AddScoped<IAccountCleanup, MessagingCleanup>();
    }
}
