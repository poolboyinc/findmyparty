using System.Text;
using System.Threading.RateLimiting;
using FindMyParty.Api.Bookings;
using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using FindMyParty.Api.Demo;
using FindMyParty.Api.Identity;
using FindMyParty.Api.Parties;
using FindMyParty.Api.Storage;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;

builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(config.GetConnectionString("DefaultConnection")));

builder.Services
    .AddIdentityCore<ApplicationUser>(o =>
    {
        o.Password.RequiredLength = 8;
        o.Password.RequireDigit = true;
        o.Password.RequireLowercase = true;
        o.Password.RequireUppercase = false;
        o.Password.RequireNonAlphanumeric = false;
        o.Lockout.MaxFailedAccessAttempts = 5;
        o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
        o.User.RequireUniqueEmail = true;
    })
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<AppDbContext>()
    .AddDefaultTokenProviders();

var jwt = config.GetSection("Jwt");
SigningKey.Require(jwt["Key"], builder.Environment.IsDevelopment());
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwt["Issuer"],
            ValidAudience = jwt["Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["Key"]!)),
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddScoped<TokenService>();
builder.Services.AddScoped<BookingService>();
builder.Services.AddScoped<PassService>();
builder.Services.AddScoped<PartyReader>();
builder.Services.AddScoped<DemoSeeder>();
if (config.GetValue<bool>("Seed:Demo")) builder.Services.AddHostedService<DemoRefresher>();
builder.Services.AddSingleton<IExternalAuthService, ExternalAuthService>();
builder.Services.AddSingleton<IImageStorage, S3ImageStorage>();

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
// Railway (and any proxy) puts the real client address in X-Forwarded-For. Without this every
// user shares one address, and one rate-limit bucket.
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.ForwardLimit = 1; // trust only the entry added by the nearest proxy
    o.KnownIPNetworks.Clear();
    o.KnownProxies.Clear();
});

builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    static RateLimitPartition<string> PerMinute(HttpContext ctx, string key, string setting, int fallback) =>
        RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = ctx.RequestServices.GetRequiredService<IConfiguration>().GetValue($"RateLimits:{setting}", fallback),
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0
        });

    static string Address(HttpContext ctx) => ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    // Sign-in endpoints: per address, strict, to slow password guessing.
    o.AddPolicy("auth", ctx => PerMinute(ctx, "auth:" + Address(ctx), "AuthPerMinute", 10));

    // Everything: per signed-in user, or per address when anonymous.
    o.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
        PerMinute(ctx, ctx.User.Identity?.IsAuthenticated == true ? "user:" + ctx.User.UserIdString() : "ip:" + Address(ctx), "GeneralPerMinute", 240));
});
builder.Services.AddControllers();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.MigrateAsync();
    var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
    foreach (var role in Roles.All)
        if (!await roles.RoleExistsAsync(role))
            await roles.CreateAsync(new IdentityRole(role));

    // Demo data, only when asked for: Seed__Demo=true (and optionally Seed__OwnerEmail).
    if (config.GetValue<bool>("Seed:Demo"))
        await scope.ServiceProvider.GetRequiredService<DemoSeeder>().EnsureAsync(config["Seed:OwnerEmail"]);

    // First admin: register in the app, then set Bootstrap__AdminEmail to that address and restart.
    if (config["Bootstrap:AdminEmail"] is { Length: > 0 } adminEmail)
    {
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        if (await users.FindByEmailAsync(adminEmail) is { } owner && !await users.IsInRoleAsync(owner, Roles.Admin))
        {
            await users.AddToRoleAsync(owner, Roles.Admin);
            app.Logger.LogWarning("Granted Admin to {UserId} from Bootstrap:AdminEmail", owner.Id);
        }
    }
}

app.UseForwardedHeaders();
app.UseExceptionHandler();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapGet("/health", async (AppDbContext db, CancellationToken ct) =>
    await db.Database.CanConnectAsync(ct)
        ? Results.Ok(new { status = "healthy", database = "ok" })
        : Results.Json(new { status = "unhealthy", database = "unreachable" }, statusCode: StatusCodes.Status503ServiceUnavailable));
app.MapControllers();

app.Run();

public partial class Program;
