using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace FindMyParty.Mobile.ViewModels;

public abstract class BaseViewModel : INotifyPropertyChanged
{
    public event PropertyChangedEventHandler? PropertyChanged;

    bool _isBusy;
    public bool IsBusy
    {
        get => _isBusy;
        set
        {
            SetProperty(ref _isBusy, value);
            OnPropertyChanged(nameof(IsNotBusy));
        }
    }

    public bool IsNotBusy => !_isBusy;

    protected bool SetProperty<T>(ref T backingStore, T value, [CallerMemberName] string propertyName = "")
    {
        if (EqualityComparer<T>.Default.Equals(backingStore, value))
            return false;

        backingStore = value;
        OnPropertyChanged(propertyName);
        return true;
    }

    protected void OnPropertyChanged([CallerMemberName] string propertyName = "") =>
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
}
