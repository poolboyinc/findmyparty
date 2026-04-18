using Microsoft.AspNetCore.Builder;

namespace FindMyParty.ServiceDefaults;

/// <summary>
/// Maps flat Railway environment variable names (e.g. DATABASE_URL, JWT_KEY) to ASP.NET
/// configuration paths (e.g. ConnectionStrings:DefaultConnection, Jwt:Key).
///
/// Call <see cref="MapRailwayEnvironment"/> in Program.cs before any configuration
/// is read so that Railway-injected env vars land in the right config slots.
/// </summary>
public static class RailwayEnvironment
{
    // Each env var maps to one or more ASP.NET config paths.
    // Multiple paths handle cases like RabbitMQ where two config sections
    // (RabbitMQ + PartyPublisher) share the same credentials.
    private static readonly (string EnvVar, string[] ConfigPaths)[] Mappings =
    [
        // Database
        ("DATABASE_URL",     ["ConnectionStrings:DefaultConnection"]),

        // JWT
        ("JWT_KEY",          ["Jwt:Key"]),

        // AWS / S3
        ("AWS_ACCESS_KEY",   ["AWS:AccessKey"]),
        ("AWS_SECRET_KEY",   ["AWS:SecretKey"]),
        ("AWS_REGION",       ["AWS:Region"]),
        ("AWS_S3_BUCKET",    ["AWS:S3:BucketName"]),

        // Redis
        ("REDIS_URL",        ["Redis:ConnectionString"]),

        // RabbitMQ — shared by both consumer and publisher config sections
        ("RABBITMQ_HOST",    ["RabbitMQ:HostName", "PartyPublisher:HostName"]),
        ("RABBITMQ_USER",    ["RabbitMQ:UserName", "PartyPublisher:UserName"]),
        ("RABBITMQ_PASS",    ["RabbitMQ:Password", "PartyPublisher:Password"]),

        // Inter-service URLs (gateway + bookings)
        ("IDENTITY_URL",     ["ServiceUrls:Identity"]),
        ("PARTIES_URL",      ["ServiceUrls:Parties"]),
        ("BOOKINGS_URL",     ["ServiceUrls:Bookings"]),
        ("PARTIES_BASE_URL", ["Services:PartiesBaseUrl"]),

        // OAuth
        ("GOOGLE_CLIENT_ID", ["Google:ClientId"]),

        // CORS
        ("CORS_ORIGINS",     ["Cors:AllowedOrigins"]),
    ];

    /// <summary>
    /// Reads every mapped env var and, if set, writes it into the configuration
    /// so downstream code reads a single unified config regardless of where
    /// the value came from.
    /// </summary>
    public static WebApplicationBuilder MapRailwayEnvironment(this WebApplicationBuilder builder)
    {
        foreach (var (envVar, configPaths) in Mappings)
        {
            var value = Environment.GetEnvironmentVariable(envVar);
            if (string.IsNullOrEmpty(value))
                continue;

            foreach (var path in configPaths)
                builder.Configuration[path] = value;
        }

        return builder;
    }
}
