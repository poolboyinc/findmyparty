using FindMyParty.Parties.API.Application.Handlers;
using FindMyParty.Parties.API.Application.IntegrationEvents.EventBus;
using FindMyParty.Parties.API.Application.IntegrationEvents.Handlers;
using FindMyParty.Parties.API.Infrastructure.Data;
using FindMyParty.Parties.API.Infrastructure.Messaging;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<PartiesDbContext>(options =>
{
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        npgsql =>
        {
            npgsql.MigrationsAssembly(typeof(Program).Assembly.FullName);
        });
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


builder.Services.AddScoped<CreatePartyCommandHandler>();
builder.Services.AddScoped<PublishPartyCommandHandler>();
builder.Services.AddScoped<UpdatePartyCommandHandler>();
builder.Services.AddScoped<CancelPartyCommandHandler>();
builder.Services.AddScoped<DeletePartyCommandHandler>();
builder.Services.AddScoped<GetPublishedPartiesQueryHandler>();
builder.Services.AddScoped<GetPartyByIdQueryHandler>();
builder.Services.AddScoped<GetHostPartiesQueryHandler>();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();


app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
