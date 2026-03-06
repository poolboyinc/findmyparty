using FindMyParty.Mobile.Models.Bookings;
using FindMyParty.Mobile.Services.Bookings;
using System.Windows.Input;

namespace FindMyParty.Mobile.ViewModels;

public class MyBookingsViewModel : BaseViewModel
{
    private readonly IBookingService _bookingService;

    public List<BookingItem> Bookings { get; private set; } = [];
    public bool HasBookings => Bookings.Count > 0;
    public bool IsEmpty => !IsBusy && !HasBookings;

    public ICommand RefreshCommand { get; }

    public MyBookingsViewModel(IBookingService bookingService)
    {
        _bookingService = bookingService;
        RefreshCommand = new Command(async () => await LoadAsync());
    }

    public async Task LoadAsync()
    {
        IsBusy = true;
        try
        {
            Bookings = await _bookingService.GetMyBookingsAsync();
            OnPropertyChanged(nameof(Bookings));
            OnPropertyChanged(nameof(HasBookings));
            OnPropertyChanged(nameof(IsEmpty));
        }
        finally
        {
            IsBusy = false;
            OnPropertyChanged(nameof(IsEmpty));
        }
    }
}
