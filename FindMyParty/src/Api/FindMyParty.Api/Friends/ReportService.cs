using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Friends;

/// <summary>Reporting a person, and the platform admin's answer: dismiss, switch their sharing off, or ban them.</summary>
public class ReportService(AppDbContext db, People people, TimeProvider time)
{
    public const int ReportsPerDay = 10;
    /// <summary>A ban is a lockout that never ends (Identity reads any lockout in the future as locked).</summary>
    public static readonly DateTimeOffset Banned = new(9999, 1, 1, 0, 0, 0, TimeSpan.Zero);

    private DateTime Now => time.GetUtcNow().UtcDateTime;

    public async Task ReportAsync(Guid me, Guid reported, ReportInput input, CancellationToken ct)
    {
        if (reported == me) throw ApiException.Invalid("You cannot report yourself.");
        if (input.Reason is not { } reason || !UserReport.Reasons.Contains(reason))
            throw ApiException.Invalid("Pick a reason: harassment, fakeProfile, spam or other.");
        var note = string.IsNullOrWhiteSpace(input.Note) ? null : input.Note.Trim();
        if (note is { Length: > 500 }) throw ApiException.Invalid("A note is at most 500 characters.");
        var key = reported.ToString();
        if (!await db.Users.AnyAsync(u => u.Id == key, ct)) throw ApiException.NotFound("Person");

        var now = Now;
        if (await db.Set<UserReport>().CountAsync(r => r.ReporterId == me && r.CreatedAt > now.AddDays(-1), ct) >= ReportsPerDay)
            throw FriendService.TooMany();

        db.Set<UserReport>().Add(new UserReport
        {
            Id = Guid.NewGuid(), ReporterId = me, ReportedUserId = reported, Reason = reason, Note = note, Status = UserReport.Open, CreatedAt = now
        });
        await db.SaveChangesAsync(ct);
    }

    public async Task<List<AdminReport>> ListAsync(string? status, CancellationToken ct)
    {
        status ??= UserReport.Open;
        if (status is not (UserReport.Open or UserReport.Resolved)) throw ApiException.Invalid("Status is open or resolved.");

        var reports = await db.Set<UserReport>().AsNoTracking().Where(r => r.Status == status)
            .OrderByDescending(r => r.CreatedAt).Take(200).ToListAsync(ct);
        var reportedIds = reports.Select(r => r.ReportedUserId).Distinct().ToList();
        var open = await db.Set<UserReport>().Where(r => r.Status == UserReport.Open && reportedIds.Contains(r.ReportedUserId))
            .GroupBy(r => r.ReportedUserId).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(g => g.Key, g => g.Count, ct);
        var persons = await people.PeopleAsync(reports.SelectMany(r => new[] { r.ReporterId, r.ReportedUserId }), ct);

        string Handle(Guid id) => persons.TryGetValue(id, out var p) ? p.Handle : "deleted";
        return reports.Select(r => new AdminReport(r.Id, r.Reason, r.Note, r.CreatedAt, r.Status,
            new ReportPerson(r.ReporterId, Handle(r.ReporterId)),
            new ReportedPerson(r.ReportedUserId, Handle(r.ReportedUserId),
                persons.TryGetValue(r.ReportedUserId, out var reportedPerson) ? reportedPerson.DisplayName : "Deleted account",
                open.GetValueOrDefault(r.ReportedUserId)))).ToList();
    }

    /// <summary>
    /// Closes a report. `suspendSharing` switches the person's sharing off for good (they vanish from friends' maps at once);
    /// `ban` also locks the account and signs it out everywhere.
    /// </summary>
    public async Task ResolveAsync(Guid adminId, Guid reportId, ResolveInput input, CancellationToken ct)
    {
        if (input.Action is not { } action || !UserReport.Actions.Contains(action))
            throw ApiException.Invalid("Action is dismiss, suspendSharing or ban.");
        var report = await db.Set<UserReport>().FirstOrDefaultAsync(r => r.Id == reportId, ct) ?? throw ApiException.NotFound("Report");
        var now = Now;
        var key = report.ReportedUserId.ToString();

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        if (action is "suspendSharing" or "ban")
            await db.Users.Where(u => u.Id == key).ExecuteUpdateAsync(s => s
                .SetProperty(u => u.SharingSuspended, true)
                .SetProperty(u => u.ShareWithFriends, false), ct);
        if (action == "ban")
        {
            var stamp = Guid.NewGuid().ToString();
            await db.Users.Where(u => u.Id == key).ExecuteUpdateAsync(s => s
                .SetProperty(u => u.LockoutEnabled, true)
                .SetProperty(u => u.LockoutEnd, Banned)
                .SetProperty(u => u.SecurityStamp, stamp), ct);
            await db.RefreshTokens.Where(t => t.UserId == key && t.RevokedAt == null)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, now), ct);
        }

        report.Status = UserReport.Resolved;
        report.Action = action;
        report.ResolvedByUserId = adminId;
        report.ResolvedAt = now;
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }
}
