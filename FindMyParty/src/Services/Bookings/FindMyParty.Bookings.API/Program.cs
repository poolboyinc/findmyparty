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
using Quartz;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<BookingsDbContext>(options =>
{
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        sqlOptions =>
        {
            sqlOptions.MigrationsAssembly(typeof(Program).Assembly.FullName);
        });
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

builder.Services.AddQuartz(q =>
{
    q.UseMicrosoftDependencyInjectionJobFactory();

    var jobKey = new JobKey("OutboxProcessorJob");

    q.AddJob<OutboxProcessorJob>(opts => opts.WithIdentity(jobKey));

    q.AddTrigger(opts => opts
        .ForJob(jobKey)
        .WithIdentity("OutboxProcessorJob-trigger")
        .WithSimpleSchedule(x => x
            .WithIntervalInSeconds(1)
            .RepeatForever()));
});

builder.Services.AddHostedService<RabbitMqPartyEventConsumer>();
builder.Services.AddScoped<PartyCancelledIntegrationEventHandler>();

builder.Services.AddScoped<CreateBookingCommandHandler>();
builder.Services.AddScoped<CancelBookingCommandHandler>();
builder.Services.AddScoped<ConfirmBookingCommandHandler>();
builder.Services.AddScoped<GetUserBookingsQueryHandler>();
builder.Services.AddScoped<GetPartyBookingsQueryHandler>();

builder.Services.AddQuartzHostedService(q => q.WaitForJobsToComplete = true);

builder.Services.Configure<RabbitMqSettings>(
    builder.Configuration.GetSection("RabbitMQ"));

builder.Services.AddSingleton<IEventBus, RabbitMqEventBus>();


builder.Services.AddAuthorization();

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
