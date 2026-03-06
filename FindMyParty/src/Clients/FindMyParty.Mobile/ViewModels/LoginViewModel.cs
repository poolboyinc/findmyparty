using FindMyParty.Mobile.Services.Auth;
using System.Windows.Input;

namespace FindMyParty.Mobile.ViewModels;

public class LoginViewModel : BaseViewModel
{
    private readonly IAuthService _authService;

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

    public ICommand LoginCommand { get; }
    public ICommand GoToRegisterCommand { get; }

    public LoginViewModel(IAuthService authService)
    {
        _authService = authService;
        LoginCommand = new Command(async () => await ExecuteLoginAsync(), () => !IsBusy);
        GoToRegisterCommand = new Command(async () => await Shell.Current.GoToAsync("//register"));
    }

    async Task ExecuteLoginAsync()
    {
        if (string.IsNullOrWhiteSpace(Email) || string.IsNullOrWhiteSpace(Password))
        {
            ErrorMessage = "Please enter your email and password.";
            return;
        }

        IsBusy = true;
        ErrorMessage = string.Empty;

        try
        {
            var success = await _authService.LoginAsync(Email, Password);
            if (success)
                await Shell.Current.GoToAsync("//main");
            else
                ErrorMessage = "Invalid email or password.";
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
