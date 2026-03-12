namespace FindMyParty.Bookings.API.Infrastructure.Outbox;

public interface IOutboxSignal
{
    void Notify();
    Task WaitAsync(CancellationToken cancellationToken);
}
