using FindMyParty.ServiceDefaults;
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
builder.MapRailwayEnvironment();

builder.Services.AddDbContext<BookingsDbContext>(options =>
{
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        npgsqlOptions =>
        {
            npgsqlOptions.MigrationsAssembly(typeof(Program).Assembly.FullName);
        });
});

var jwtSection = builder.Configuration.GetSection("Jwt");
var jwtKey = jwtSection["Key"]
    ?? throw new InvalidOperationException(
        "Jwt:Key is not configured. Set the JWT_KEY environment variable.");

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
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
    var db = scope.ServiceProvider.GetRequiredService<BookingsDbContext>();
    await db.Database.MigrateAsync();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
