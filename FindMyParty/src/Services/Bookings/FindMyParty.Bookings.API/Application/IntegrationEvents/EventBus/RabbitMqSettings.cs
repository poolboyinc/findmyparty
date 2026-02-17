namespace FindMyParty.Bookings.API.Application.IntegrationEvents.EventBus;

public class RabbitMqSettings
{
    public string HostName { get; set; } = default!;
    public string UserName { get; set; } = default!;
    public string Password { get; set; } = default!;
    public string ExchangeName { get; set; } = default!;
}
