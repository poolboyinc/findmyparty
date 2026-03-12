using System.Threading.Channels;

namespace FindMyParty.Bookings.API.Infrastructure.Outbox;

public class OutboxSignal : IOutboxSignal
{
    // Capacity 1 + DropWrite: if a signal is already waiting, ignore duplicates.
    // We only need to know "something arrived", not how many times.
    private readonly Channel<bool> _channel = Channel.CreateBounded<bool>(
        new BoundedChannelOptions(1) { FullMode = BoundedChannelFullMode.DropWrite });

    public void Notify() => _channel.Writer.TryWrite(true);

    public async Task WaitAsync(CancellationToken cancellationToken)
    {
        await _channel.Reader.WaitToReadAsync(cancellationToken);
        _channel.Reader.TryRead(out _);
    }
}
