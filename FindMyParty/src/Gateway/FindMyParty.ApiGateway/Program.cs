using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// Allow Railway env vars to override cluster addresses
var identityUrl = builder.Configuration["ServiceUrls:Identity"] ?? "http://identity-api:8080";
var partiesUrl = builder.Configuration["ServiceUrls:Parties"] ?? "http://parties-api:8080";
var bookingsUrl = builder.Configuration["ServiceUrls:Bookings"] ?? "http://bookings-api:8080";

builder.Configuration["ReverseProxy:Clusters:identity:Destinations:identity/d1:Address"] = identityUrl;
builder.Configuration["ReverseProxy:Clusters:parties:Destinations:parties/d1:Address"] = partiesUrl;
builder.Configuration["ReverseProxy:Clusters:bookings:Destinations:bookings/d1:Address"] = bookingsUrl;

builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

// TODO: Replace AllowAnyOrigin with specific production domains before going live
// e.g. .WithOrigins("https://yourapp.com", "https://www.yourapp.com")
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy
            .AllowAnyOrigin()
            .AllowAnyMethod()
            .AllowAnyHeader();
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

app.UseCors();
app.UseRateLimiter();

app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

app.MapReverseProxy();

app.Run();
