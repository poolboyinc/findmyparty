using FindMyParty.Mobile.Constants;
using FindMyParty.Mobile.Models.Parties;
using FindMyParty.Mobile.ViewModels;
using System.Globalization;
using System.Text.Json;

namespace FindMyParty.Mobile.Views;

public partial class ExplorePage : ContentPage
{
    private readonly ExploreViewModel _viewModel;
    private bool _mapInitialized = false;

    private static readonly JsonSerializerOptions CamelCase = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public ExplorePage()
    {
        InitializeComponent();
        _viewModel = IPlatformApplication.Current!.Services
            .GetRequiredService<ExploreViewModel>();
        BindingContext = _viewModel;
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();

        if (_mapInitialized)
            return;

        _mapInitialized = true;
        await LoadMapAsync();
    }

    private async Task LoadMapAsync()
    {
        double lat = 51.5074, lng = -0.1278; // Default: London

        var status = await Permissions.RequestAsync<Permissions.LocationWhenInUse>();
        if (status == PermissionStatus.Granted)
        {
            try
            {
                var location =
                    await Geolocation.Default.GetLastKnownLocationAsync() ??
                    await Geolocation.Default.GetLocationAsync(new GeolocationRequest
                    {
                        DesiredAccuracy = GeolocationAccuracy.Medium,
                        Timeout = TimeSpan.FromSeconds(5)
                    });

                if (location != null)
                {
                    lat = location.Latitude;
                    lng = location.Longitude;
                }
            }
            catch { /* use defaults */ }
        }

        var parties = await _viewModel.LoadPartiesAsync(lat, lng);
        mapWebView.Source = new HtmlWebViewSource
        {
            Html = BuildMapHtml(lat, lng, parties)
        };
    }

    private static string BuildMapHtml(double lat, double lng, List<PartyMapItem> parties)
    {
        using var stream = FileSystem.OpenAppPackageFileAsync("map.html").GetAwaiter().GetResult();
        using var reader = new StreamReader(stream);
        var html = reader.ReadToEnd();

        return html
            .Replace("%%MAPBOX_TOKEN%%", ApiConstants.MapboxPublicToken)
            .Replace("%%CENTER_LAT%%", lat.ToString("F6", CultureInfo.InvariantCulture))
            .Replace("%%CENTER_LNG%%", lng.ToString("F6", CultureInfo.InvariantCulture))
            .Replace("%%PARTIES_DATA%%", JsonSerializer.Serialize(parties, CamelCase));
    }

    private void OnNavigating(object sender, WebNavigatingEventArgs e)
    {
        if (!e.Url.StartsWith("fmp://"))
            return;

        e.Cancel = true;

        if (e.Url.StartsWith("fmp://partyTapped"))
        {
            var id = ParseQueryParam(e.Url, "id");
            if (id != null)
                _ = Shell.Current.GoToAsync($"partyDetail?id={id}");
        }
    }

    private static string? ParseQueryParam(string url, string key)
    {
        var query = url.Contains('?') ? url.Split('?')[1] : string.Empty;
        return query.Split('&')
            .Select(p => p.Split('='))
            .FirstOrDefault(p => p.Length == 2 && p[0] == key)?[1];
    }
}
