namespace FindMyParty.Mobile.Constants;

public static class ApiConstants
{
    public const string MapboxPublicToken = "pk.eyJ1IjoicG9vbGJvaWluYyIsImEiOiJjbHR1MWxkeTQxYXlwMmpuamFzcHVkeDdiIn0.Ti_BulPJmDGDsxQ3bMhZxQ";

#if DEBUG
    public static string IdentityBaseUrl =>
        DeviceInfo.Platform == DevicePlatform.Android
            ? "http://10.0.2.2:5034"
            : "http://localhost:5034";

    public static string PartiesBaseUrl =>
        DeviceInfo.Platform == DevicePlatform.Android
            ? "http://10.0.2.2:5246"
            : "http://localhost:5246";

    public static string BookingsBaseUrl =>
        DeviceInfo.Platform == DevicePlatform.Android
            ? "http://10.0.2.2:5074"
            : "http://localhost:5074";
#else
    public static string IdentityBaseUrl => "https://api.findmyparty.com/identity";
    public static string PartiesBaseUrl  => "https://api.findmyparty.com/parties";
    public static string BookingsBaseUrl => "https://api.findmyparty.com/bookings";
#endif
}
