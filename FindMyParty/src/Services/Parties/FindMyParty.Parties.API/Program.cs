using Amazon.S3;
using Amazon.S3.Model;
using FindMyParty.Parties.API.Application.Handlers;
using FindMyParty.Parties.API.Application.IntegrationEvents.EventBus;
using FindMyParty.Parties.API.Application.IntegrationEvents.Handlers;
using FindMyParty.Parties.API.Infrastructure.Data;
using FindMyParty.Parties.API.Infrastructure.Messaging;
using FindMyParty.Parties.API.Infrastructure.Storage;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<PartiesDbContext>(options =>
{
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        npgsql =>
        {
            npgsql.MigrationsAssembly(typeof(Program).Assembly.FullName);
            // Auto-retry transient connection/command failures (Railway network
            // blips, brief Postgres unavailability) instead of throwing hard.
            npgsql.EnableRetryOnFailure(
                maxRetryCount: 5,
                maxRetryDelay: TimeSpan.FromSeconds(10),
                errorCodesToAdd: null);
        });
});

// A BackgroundService throwing (e.g. the RabbitMQ consumer on a broker blip)
// must NOT tear down the whole host. The default StopHost behavior turned a
// transient dependency failure into a full outage. Keep the API alive.
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

builder.Services.AddAuthorization();

builder.Services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = builder.Configuration["Redis:ConnectionString"] ?? "localhost:6379";
    options.InstanceName = "fmp:";
});

builder.Services.AddHostedService<RabbitMqEventConsumer>();

builder.Services.Configure<PartyPublisherSettings>(
    builder.Configuration.GetSection("PartyPublisher"));
builder.Services.AddSingleton<IEventBus, RabbitMqEventBus>();

builder.Services.AddScoped<BookingCreatedEventHandler>();
builder.Services.AddScoped<BookingCancelledEventHandler>();


builder.Services.AddScoped<CreatePartyCommandHandler>();
builder.Services.AddScoped<PublishPartyCommandHandler>();
builder.Services.AddScoped<UpdatePartyCommandHandler>();
builder.Services.AddScoped<CancelPartyCommandHandler>();
builder.Services.AddScoped<DeletePartyCommandHandler>();
builder.Services.AddScoped<GetPublishedPartiesQueryHandler>();
builder.Services.AddScoped<GetPartyByIdQueryHandler>();
builder.Services.AddScoped<GetPartiesByIdsQueryHandler>();
builder.Services.AddScoped<GetHostPartiesQueryHandler>();

builder.Services.AddSingleton<IAmazonS3>(_ =>
{
    var region = Amazon.RegionEndpoint.GetBySystemName(
        builder.Configuration["AWS:Region"] ?? "eu-north-1");

    var accessKey = builder.Configuration["AWS:AccessKey"];
    var secretKey = builder.Configuration["AWS:SecretKey"];

    if (!string.IsNullOrEmpty(accessKey) && !string.IsNullOrEmpty(secretKey))
        return new AmazonS3Client(accessKey, secretKey, region);

    return new AmazonS3Client(region);
});
builder.Services.AddScoped<IS3ImageService, S3ImageService>();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    try
    {
        var db = scope.ServiceProvider.GetRequiredService<PartiesDbContext>();
        await db.Database.MigrateAsync();
    }
    catch (Exception ex)
    {
        // Don't let a transient DB hiccup at startup stop the service from
        // serving HTTP. EnableRetryOnFailure already retried; log and continue.
        Console.WriteLine($"[Startup] Database migration failed (continuing): {ex.Message}");
    }
}

app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
