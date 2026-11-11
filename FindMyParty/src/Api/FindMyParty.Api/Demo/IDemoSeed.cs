namespace FindMyParty.Api.Demo;

/// <summary>
/// A feature's part of the demo data. Runs after the base seed (venues, parties, demo guests), lowest Order first,
/// at start-up and again every 30 minutes. So it must be safe to repeat: create what is missing,
/// with ids from demo.IdFor("some:key") so the same row is found next time.
/// Any class in this project that implements it is picked up; nothing needs registering.
/// </summary>
public interface IDemoSeed
{
    int Order { get; }
    Task SeedAsync(DemoContext demo, CancellationToken ct);
}
