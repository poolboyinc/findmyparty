namespace FindMyParty.Api.Common;

/// <summary>
/// Tells every ICheckInListener about a scan that has been committed. Each listener runs in its own scope
/// (its own database context), so one that fails leaves nothing behind for the next, and never fails the scan.
/// </summary>
public class CheckInListeners(IServiceScopeFactory scopes, ILogger<CheckInListeners> logger)
{
    public async Task PublishAsync(CheckInEvent e, CancellationToken ct = default)
    {
        for (var i = 0; ; i++)
        {
            await using var scope = scopes.CreateAsyncScope();
            var listener = scope.ServiceProvider.GetServices<ICheckInListener>().ElementAtOrDefault(i);
            if (listener is null) return;
            try
            {
                await listener.OnCheckedInAsync(e, ct);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "{Listener} failed for check-in {CheckInId}; the scan stands", listener.GetType().Name, e.CheckInId);
            }
        }
    }
}
