using FindMyParty.Api.Demo;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace FindMyParty.Api.Common;

/// <summary>
/// A feature's own start-up code. Every class in this project that implements IFeature (and has a constructor
/// without parameters) is created once at start-up and asked to register its services, so adding a feature
/// never means editing Program.cs.
/// </summary>
public interface IFeature { void Add(IServiceCollection services, IConfiguration config); }

public static class Features
{
    public static IServiceCollection AddFeatures(this IServiceCollection services, IConfiguration config)
    {
        // What the seams themselves need.
        services.AddScoped<Enrichers>();
        services.AddSingleton<CheckInListeners>();
        services.AddSingleton<SharePage>();

        // By name, so the order does not depend on how the compiler laid the classes out.
        var types = typeof(Features).Assembly.GetTypes()
            .Where(t => t is { IsClass: true, IsAbstract: false })
            .OrderBy(t => t.FullName, StringComparer.Ordinal)
            .ToList();

        foreach (var type in types.Where(typeof(IFeature).IsAssignableFrom))
            ((IFeature)Activator.CreateInstance(type)!).Add(services, config);

        // Demo seeds need no registration: a class that implements IDemoSeed is enough.
        foreach (var type in types.Where(typeof(IDemoSeed).IsAssignableFrom))
            services.TryAddEnumerable(ServiceDescriptor.Scoped(typeof(IDemoSeed), type));

        // Defaults, added last and only when no feature brought its own.
        services.TryAddSingleton<INotifier, NullNotifier>();
        services.TryAddSingleton<IEmailSender, LogEmailSender>();
        services.TryAddScoped<IVenueAccess, HostOnlyVenueAccess>();
        return services;
    }
}
