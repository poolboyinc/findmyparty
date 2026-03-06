using FindMyParty.Mobile.Models.Auth;
using FindMyParty.Mobile.Services.Auth;
using FindMyParty.Mobile.Services.Bookings;

namespace FindMyParty.Mobile.ViewModels;

public class ProfileViewModel : BaseViewModel
{
    private readonly IAuthService _authService;
    private readonly IBookingService _bookingService;

    public UserInfo? UserInfo { get; private set; }
    public int BookingCount { get; private set; }

    public ProfileViewModel(IAuthService authService, IBookingService bookingService)
    {
        _authService = authService;
        _bookingService = bookingService;
    }

    public async Task LoadAsync()
    {
        IsBusy = true;
        try
        {
            var userTask = _authService.GetUserInfoAsync();
            var bookingsTask = _bookingService.GetMyBookingsAsync();

            await Task.WhenAll(userTask, bookingsTask);

            UserInfo = await userTask;
            BookingCount = (await bookingsTask).Count;

            OnPropertyChanged(nameof(UserInfo));
            OnPropertyChanged(nameof(BookingCount));
        }
        finally
        {
            IsBusy = false;
        }
    }

    public async Task LogoutAsync()
    {
        await _authService.LogoutAsync();
    }
}
