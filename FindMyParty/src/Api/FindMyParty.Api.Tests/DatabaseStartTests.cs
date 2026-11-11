using FindMyParty.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace FindMyParty.Api.Tests;

/// <summary>Starting against a database: fresh, current, or made by the migrations this version replaced.</summary>
[Collection("api")]
public class DatabaseStartTests(TestApp app)
{
    private AppDbContext Db(string database) =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(app.ConnectionStringFor(database)).Options);

    private static IConfiguration Settings(bool reset) =>
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { [DatabaseStart.ResetSetting] = reset ? "true" : null }).Build();

    private static string NewDatabase() => "start_" + Guid.NewGuid().ToString("N")[..10];

    /// <summary>A database as the replaced migrations left it: an old table with a row, and the old migration's id.</summary>
    private static async Task MakeOldAsync(AppDbContext db)
    {
        await db.Database.EnsureCreatedAsync();
        await db.Database.ExecuteSqlRawAsync("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE "__EFMigrationsHistory" ("MigrationId" varchar(150) PRIMARY KEY, "ProductVersion" varchar(32) NOT NULL);
            INSERT INTO "__EFMigrationsHistory" VALUES ('20261110130446_Initial', '10.0.4');
            CREATE TABLE "Parties" ("Id" uuid PRIMARY KEY, "Title" text);
            INSERT INTO "Parties" VALUES ('11111111-1111-1111-1111-111111111111', 'Old');
            """);
    }

    [Fact]
    public async Task A_fresh_database_is_migrated_and_a_second_start_changes_nothing()
    {
        await using var db = Db(NewDatabase());

        await DatabaseStart.PrepareAsync(db, Settings(reset: false), NullLogger.Instance);
        await DatabaseStart.PrepareAsync(db, Settings(reset: false), NullLogger.Instance);

        Assert.Empty(await db.Database.GetPendingMigrationsAsync());
        Assert.Equal(0, await db.Parties.CountAsync());
    }

    [Fact]
    public async Task A_database_from_the_replaced_migrations_stops_the_start_unless_a_reset_is_asked_for()
    {
        await using var db = Db(NewDatabase());
        await MakeOldAsync(db);

        var refused = await Assert.ThrowsAsync<InvalidOperationException>(() => DatabaseStart.PrepareAsync(db, Settings(reset: false), NullLogger.Instance));
        Assert.Contains("Database__ResetIfMismatched=true", refused.Message);
        Assert.Equal(1, await db.Database.SqlQueryRaw<int>("SELECT count(*)::int AS \"Value\" FROM \"Parties\"").SingleAsync());
    }

    [Fact]
    public async Task With_the_reset_asked_for_the_old_tables_go_and_the_database_is_built_again()
    {
        await using var db = Db(NewDatabase());
        await MakeOldAsync(db);

        await DatabaseStart.PrepareAsync(db, Settings(reset: true), NullLogger.Instance);

        Assert.Empty(await db.Database.GetPendingMigrationsAsync());
        Assert.DoesNotContain("20261110130446_Initial", await db.Database.GetAppliedMigrationsAsync());
        Assert.Equal(0, await db.Parties.CountAsync());
        Assert.Equal(6, await db.Set<FindMyParty.Api.Cities.City>().CountAsync());
    }
}
