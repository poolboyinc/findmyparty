using FindMyParty.Mobile.Constants;
using FindMyParty.Mobile.Models.Bookings;
using FindMyParty.Mobile.Services.Auth;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace FindMyParty.Mobile.Services.Bookings;

public class BookingService : IBookingService
{
    private readonly HttpClient _http;
    private readonly IAuthService _authService;

    public BookingService(IAuthService authService)
    {
        _authService = authService;
        _http = new HttpClient
        {
            BaseAddress = new Uri(ApiConstants.BookingsBaseUrl)
        };
    }

    public async Task<List<BookingItem>> GetMyBookingsAsync()
    {
        var token = await _authService.GetTokenAsync();
        if (token == null) return [];

        _http.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token);

        var result = await _http.GetFromJsonAsync<List<BookingItem>>("api/bookings/my");
        return result ?? [];
    }

    public async Task<bool> CreateBookingAsync(Guid partyId, int ticketCount)
    {
        var token = await _authService.GetTokenAsync();
        if (token == null)
            return false;

        _http.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token);

        var request = new HttpRequestMessage(HttpMethod.Post, "api/bookings")
        {
            Content = JsonContent.Create(new { PartyId = partyId, TicketCount = ticketCount })
        };
        request.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString());

        var response = await _http.SendAsync(request);
        return response.IsSuccessStatusCode;
    }
}
