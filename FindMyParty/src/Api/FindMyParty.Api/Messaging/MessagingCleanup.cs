using FindMyParty.Api.Common;
using FindMyParty.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Messaging;

/// <summary>A deleted account's devices and reset links go with it.</summary>
public class MessagingCleanup(AppDbContext db) : IAccountCleanup
{
    public async Task DeleteAsync(Guid userId, CancellationToken ct)
    {
        await db.Set<PushDevice>().Where(d => d.UserId == userId).ExecuteDeleteAsync(ct);
        await db.Set<PasswordReset>().Where(r => r.UserId == userId).ExecuteDeleteAsync(ct);
    }
}
