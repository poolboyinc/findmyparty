using FindMyParty.Mobile.Services.Auth;
using System.Windows.Input;

namespace FindMyParty.Mobile.ViewModels;

public class RegisterViewModel : BaseViewModel
{
    private readonly IAuthService _authService;

    string _userName = string.Empty;
    public string UserName
    {
        get => _userName;
        set => SetProperty(ref _userName, value);
    }

    string _email = string.Empty;
    public string Email
    {
        get => _email;
        set => SetProperty(ref _email, value);
    }

    string _password = string.Empty;
    public string Password
    {
        get => _password;
        set => SetProperty(ref _password, value);
    }

    string _errorMessage = string.Empty;
    public string ErrorMessage
    {
        get => _errorMessage;
        set
        {
            SetProperty(ref _errorMessage, value);
            OnPropertyChanged(nameof(HasError));
        }
    }

    public bool HasError => !string.IsNullOrEmpty(_errorMessage);

    public ICommand RegisterCommand { get; }
    public ICommand GoToLoginCommand { get; }

    public RegisterViewModel(IAuthService authService)
    {
        _authService = authService;
        RegisterCommand = new Command(async () => await ExecuteRegisterAsync(), () => !IsBusy);
        GoToLoginCommand = new Command(async () => await Shell.Current.GoToAsync("//login"));
    }

    async Task ExecuteRegisterAsync()
    {
        if (string.IsNullOrWhiteSpace(UserName) ||
            string.IsNullOrWhiteSpace(Email) ||
            string.IsNullOrWhiteSpace(Password))
        {
            ErrorMessage = "All fields are required.";
            return;
        }

        IsBusy = true;
        ErrorMessage = string.Empty;

        try
        {
            var success = await _authService.RegisterAsync(UserName, Email, Password);
            if (success)
                await Shell.Current.GoToAsync("//main");
            else
                ErrorMessage = "Registration failed. Email or username may already be in use.";
        }
        catch
        {
            ErrorMessage = "Unable to connect. Please try again.";
        }
        finally
        {
            IsBusy = false;
        }
    }
}
