using FindMyParty.Mobile.Models.Parties;
using FindMyParty.Mobile.Services.Bookings;
using FindMyParty.Mobile.Services.Parties;
using System.Windows.Input;

namespace FindMyParty.Mobile.ViewModels;

public class PartyDetailViewModel : BaseViewModel
{
    private readonly IPartyService _partyService;
    private readonly IBookingService _bookingService;

    public PartyDetail? Party { get; private set; }

    int _ticketCount = 1;
    public int TicketCount
    {
        get => _ticketCount;
        set
        {
            SetProperty(ref _ticketCount, value);
            OnPropertyChanged(nameof(TotalPrice));
            OnPropertyChanged(nameof(TotalPriceText));
        }
    }

    public decimal TotalPrice => (Party?.Price ?? 0) * TicketCount;
    public string TotalPriceText => $"€{TotalPrice:F2}";

    public int MaxTickets => Party != null
        ? Math.Min(10, Party.RemainingCapacity)
        : 1;

    public bool CanBook => !IsBusy && !BookingSuccess && Party?.IsSoldOut == false && MaxTickets > 0;

    string _statusMessage = string.Empty;
    public string StatusMessage
    {
        get => _statusMessage;
        set
        {
            SetProperty(ref _statusMessage, value);
            OnPropertyChanged(nameof(HasStatus));
        }
    }
    public bool HasStatus => !string.IsNullOrEmpty(_statusMessage);

    bool _bookingSuccess;
    public bool BookingSuccess
    {
        get => _bookingSuccess;
        set
        {
            SetProperty(ref _bookingSuccess, value);
            OnPropertyChanged(nameof(CanBook));
        }
    }

    public ICommand IncrementCommand { get; }
    public ICommand DecrementCommand { get; }
    public ICommand BookCommand { get; }

    public PartyDetailViewModel(IPartyService partyService, IBookingService bookingService)
    {
        _partyService = partyService;
        _bookingService = bookingService;

        IncrementCommand = new Command(
            () => TicketCount++,
            () => TicketCount < MaxTickets);

        DecrementCommand = new Command(
            () => TicketCount--,
            () => TicketCount > 1);

        BookCommand = new Command(
            async () => await ExecuteBookAsync(),
            () => CanBook);
    }

    public async Task LoadAsync(Guid partyId)
    {
        IsBusy = true;
        StatusMessage = string.Empty;
        BookingSuccess = false;
        TicketCount = 1;

        try
        {
            Party = await _partyService.GetPartyByIdAsync(partyId);
            OnPropertyChanged(nameof(Party));
            OnPropertyChanged(nameof(TotalPrice));
            OnPropertyChanged(nameof(TotalPriceText));
            OnPropertyChanged(nameof(MaxTickets));
            OnPropertyChanged(nameof(CanBook));
            ((Command)IncrementCommand).ChangeCanExecute();
            ((Command)DecrementCommand).ChangeCanExecute();
            ((Command)BookCommand).ChangeCanExecute();
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task ExecuteBookAsync()
    {
        if (Party == null) return;

        IsBusy = true;
        StatusMessage = string.Empty;
        ((Command)BookCommand).ChangeCanExecute();

        try
        {
            var success = await _bookingService.CreateBookingAsync(Party.Id, TicketCount);
            if (success)
            {
                BookingSuccess = true;
                StatusMessage = $"You're in! {TicketCount} ticket{(TicketCount > 1 ? "s" : "")} booked.";
            }
            else
            {
                StatusMessage = "Booking failed. The party may be sold out.";
            }
        }
        catch
        {
            StatusMessage = "Unable to connect. Please try again.";
        }
        finally
        {
            IsBusy = false;
            ((Command)BookCommand).ChangeCanExecute();
        }
    }
}
