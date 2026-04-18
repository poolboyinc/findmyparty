using FindMyParty.ServiceDefaults;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);
builder.MapRailwayEnvironment();

// Allow Railway env vars to override cluster addresses
var identityUrl = builder.Configuration["ServiceUrls:Identity"] ?? "http://identity-api:8080";
var partiesUrl = builder.Configuration["ServiceUrls:Parties"] ?? "http://parties-api:8080";
var bookingsUrl = builder.Configuration["ServiceUrls:Bookings"] ?? "http://bookings-api:8080";

builder.Configuration["ReverseProxy:Clusters:identity:Destinations:identity/d1:Address"] = identityUrl;
builder.Configuration["ReverseProxy:Clusters:parties:Destinations:parties/d1:Address"] = partiesUrl;
builder.Configuration["ReverseProxy:Clusters:bookings:Destinations:bookings/d1:Address"] = bookingsUrl;

builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

// Honor X-Forwarded-For / X-Forwarded-Proto from Railway's edge proxy so the
// real client IP (not the Railway proxy IP) is used for rate limiting.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

// CORS: the mobile app doesn't need CORS (native HTTP). Only browsers do.
// In Development allow anything; in Production allow only explicitly configured origins.
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        if (builder.Environment.IsDevelopment())
        {
            policy.SetIsOriginAllowed(_ => true)
                  .AllowAnyMethod()
                  .AllowAnyHeader()
                  .AllowCredentials();
        }
        else if (allowedOrigins.Length > 0)
        {
            policy.WithOrigins(allowedOrigins)
                  .AllowAnyMethod()
                  .AllowAnyHeader()
                  .AllowCredentials();
        }
        // else: no CORS policy — browsers will be blocked, native mobile traffic unaffected.
    });
});

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // General policy — applied to all routes
    // 60 requests per minute per IP
    options.AddPolicy("general", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 60,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }));

    // Auth policy — stricter to slow down brute force on login/register
    // 10 requests per minute per IP
    options.AddPolicy("auth", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }));
});

var app = builder.Build();

// Must be first: rewrites RemoteIpAddress / scheme from proxy headers.
app.UseForwardedHeaders();

app.UseCors();
app.UseRateLimiter();

app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

app.MapReverseProxy();

app.Run();
