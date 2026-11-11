namespace FindMyParty.Api.Common;

public static class Links
{
    /// <summary>
    /// An address the outside world can open: under Public:BaseUrl when that is set,
    /// else under the scheme and host this request came in on.
    /// </summary>
    public static string PublicUrl(HttpContext context, string path)
    {
        var configured = context.RequestServices.GetRequiredService<IConfiguration>()["Public:BaseUrl"];
        var root = string.IsNullOrWhiteSpace(configured)
            ? $"{context.Request.Scheme}://{context.Request.Host}"
            : configured.TrimEnd('/');
        return $"{root}/{path.TrimStart('/')}";
    }
}
