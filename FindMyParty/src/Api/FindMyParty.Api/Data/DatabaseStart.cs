using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Data;

/// <summary>Brings the database up to this build's model when the app starts.</summary>
public static class DatabaseStart
{
    public const string ResetSetting = "Database:ResetIfMismatched";

    /// <summary>
    /// Applies the migrations this build has. A database that holds migrations this build does not know (an
    /// older line of migrations that was replaced) cannot be brought forward: with <see cref="ResetSetting"/>
    /// true its tables are dropped and it is built again from nothing; without it the app refuses to start and
    /// says why, so nobody loses data by accident.
    /// </summary>
    public static async Task PrepareAsync(AppDbContext db, IConfiguration config, ILogger logger, CancellationToken ct = default)
    {
        var known = db.Database.GetMigrations().ToHashSet();
        var applied = (await db.Database.GetAppliedMigrationsAsync(ct)).ToList();
        var strangers = applied.Where(id => !known.Contains(id)).ToList();

        if (strangers.Count > 0)
        {
            if (!config.GetValue<bool>(ResetSetting))
                throw new InvalidOperationException(
                    $"The database holds migrations this version does not know ({string.Join(", ", strangers)}). " +
                    $"It was made by an older line of migrations. To drop its tables and build it again, start once with {ResetSetting.Replace(":", "__")}=true, then remove the setting.");

            logger.LogWarning("Database reset: dropping every table (unknown migrations {Migrations}) and building it again", string.Join(", ", strangers));
            await db.Database.ExecuteSqlRawAsync("DROP SCHEMA public CASCADE; CREATE SCHEMA public;", ct);
        }

        await db.Database.MigrateAsync(ct);
    }
}
