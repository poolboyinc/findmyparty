using System.Net.Http.Headers;
using System.Net.Http.Json;
using FindMyParty.Api.Common;

namespace FindMyParty.Api.Messaging;

/// <summary>
/// Sends mail through a Resend-compatible API: POST {Email:BaseUrl}/emails with the key as a bearer token.
/// Registered only when Email:ApiKey is set; without a key it only logs what it would have sent.
/// A refused or failed send throws, so the caller decides what the user hears.
/// </summary>
public class ResendEmailSender(IHttpClientFactory http, IConfiguration config, IHostEnvironment environment, ILogger<ResendEmailSender> logger)
    : IEmailSender
{
    public const string HttpClientName = "resend";
    public const string DefaultFrom = "FindMyParty <no-reply@findmyparty.app>";
    public const string DefaultBaseUrl = "https://api.resend.com";

    public async Task SendAsync(string to, string subject, string html, string text, CancellationToken ct = default)
    {
        var key = config["Email:ApiKey"];
        if (string.IsNullOrWhiteSpace(key))
        {
            logger.LogInformation("would send '{Subject}' to {Address}", subject, to);
            if (environment.IsDevelopment()) logger.LogInformation("{Text}", text);
            return;
        }

        var from = config["Email:From"] is { Length: > 0 } f ? f : DefaultFrom;
        var baseUrl = (config["Email:BaseUrl"] is { Length: > 0 } b ? b : DefaultBaseUrl).TrimEnd('/');
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/emails")
        {
            Content = JsonContent.Create(new { from, to = new[] { to }, subject, html, text }),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);

        using var response = await http.CreateClient(HttpClientName).SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            var detail = await response.Content.ReadAsStringAsync(ct);
            logger.LogWarning("Mail '{Subject}' was refused: {Status} {Detail}", subject, (int)response.StatusCode, detail.Length > 300 ? detail[..300] : detail);
            throw new HttpRequestException($"Mail API answered {(int)response.StatusCode}.", null, response.StatusCode);
        }
    }
}
