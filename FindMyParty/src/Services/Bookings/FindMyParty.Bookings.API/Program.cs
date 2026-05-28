using FindMyParty.Bookings.API.Application.Common;
using FindMyParty.Bookings.API.Application.Handlers;
using FindMyParty.Bookings.API.Application.IntegrationEvents.EventBus;
using FindMyParty.Bookings.API.Application.IntegrationEvents.Handlers;
using FindMyParty.Bookings.API.Infrastructure.Data;
using FindMyParty.Bookings.API.Infrastructure.Messaging;
using FindMyParty.Bookings.API.Infrastructure.Outbox;
using FindMyParty.Bookings.API.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<BookingsDbContext>(options =>
{
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        npgsqlOptions =>
        {
            npgsqlOptions.MigrationsAssembly(typeof(Program).Assembly.FullName);
            // Auto-retry transient connection/command failures (Railway network
            // blips, brief Postgres unavailability) instead of surfacing them as
            // hard exceptions. The EF error "likely due to a transient failure"
            // is exactly what this addresses.
            npgsqlOptions.EnableRetryOnFailure(
                maxRetryCount: 5,
                maxRetryDelay: TimeSpan.FromSeconds(10),
                errorCodesToAdd: null);
        });
});

// A BackgroundService throwing must NOT tear down the whole host. The default
// (StopHost) turned a transient DB blip in OutboxProcessorService into a full
// outage — the HTTP API died and the gateway 504'd. Keep the API alive even if
// a background worker fails.
builder.Services.Configure<HostOptions>(options =>
{
    options.BackgroundServiceExceptionBehavior = BackgroundServiceExceptionBehavior.Ignore;
});

var jwtSection = builder.Configuration.GetSection("Jwt");
var jwtKey = jwtSection["Key"]!;

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = false; // true in prod
        options.SaveToken = true;

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,

            ValidIssuer = jwtSection["Issuer"],
            ValidAudience = jwtSection["Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtKey)),

            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();

builder.Services.AddHttpClient<IPartyAvailabilityService, PartyAvailabilityService>(
    client =>
    {
        var url = builder.Configuration["Services:PartiesBaseUrl"] ?? "http://localhost:5246";
        client.BaseAddress = new Uri(url);
    });

builder.Services.AddHttpClient<IPartyLookupService, PartyLookupService>(
    client =>
    {
        var url = builder.Configuration["Services:PartiesBaseUrl"] ?? "http://localhost:5246";
        client.BaseAddress = new Uri(url);
        // Keep the timeout tight — this enriches the bookings list and we'd
        // rather degrade to "no party metadata" than block the user's request.
        client.Timeout = TimeSpan.FromSeconds(5);
    });

builder.Services.AddSingleton<IOutboxSignal, OutboxSignal>();
builder.Services.AddHostedService<OutboxProcessorService>();

builder.Services.AddHostedService<RabbitMqPartyEventConsumer>();
builder.Services.AddScoped<PartyCancelledIntegrationEventHandler>();

builder.Services.AddScoped<CreateBookingCommandHandler>();
builder.Services.AddScoped<CancelBookingCommandHandler>();
builder.Services.AddScoped<ConfirmBookingCommandHandler>();
builder.Services.AddScoped<GetUserBookingsQueryHandler>();
builder.Services.AddScoped<GetPartyBookingsQueryHandler>();

builder.Services.Configure<RabbitMqSettings>(
    builder.Configuration.GetSection("RabbitMQ"));

builder.Services.AddSingleton<IEventBus, RabbitMqEventBus>();


builder.Services.AddAuthorization();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    try
    {
        var db = scope.ServiceProvider.GetRequiredService<BookingsDbContext>();
        await db.Database.MigrateAsync();
    }
    catch (Exception ex)
    {
        // Don't let a transient DB hiccup at startup stop the service from
        // coming up and serving HTTP. EnableRetryOnFailure already retried;
        // log and continue so the gateway can still reach us.
        Console.WriteLine($"[Startup] Database migration failed (continuing): {ex.Message}");
    }
}

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
