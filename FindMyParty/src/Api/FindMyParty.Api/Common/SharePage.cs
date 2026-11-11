using System.Text.Encodings.Web;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;

namespace FindMyParty.Api.Common;

/// <summary>
/// The small web page behind a shared link (/p, /v, /r, /g, /i, /reset). Chat apps read its Open Graph tags
/// for the preview; a phone that opens it is sent on to the app.
/// </summary>
public class SharePage(IConfiguration config)
{
    private static readonly HtmlEncoder Html = HtmlEncoder.Default;

    private const string Style =
        "html,body{height:100%;margin:0}" +
        "body{background:#07060d;color:#f4f2fa;font:16px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" +
        "display:flex;align-items:center;justify-content:center;text-align:center}" +
        "main{max-width:22rem;padding:2rem}" +
        "h1{font-size:1.5rem;line-height:1.2;margin:0 0 .5rem}" +
        "p{margin:0 0 1.75rem;color:#a9a4bd}" +
        "a{color:#f4f2fa}" +
        ".open{display:block;background:#f4f2fa;color:#07060d;text-decoration:none;font-weight:600;padding:.85rem 1rem;border-radius:.75rem}" +
        ".store{display:inline-block;margin-top:1rem;font-size:.9rem}";

    /// <summary>The address that opens this path in the app, e.g. findmypartymobileapp://party/{id}.</summary>
    public string AppUrl(string appPath)
    {
        var scheme = config["App:Scheme"] is { Length: > 0 } s ? s : "findmypartymobileapp";
        return $"{scheme}://{appPath.TrimStart('/')}";
    }

    /// <summary>
    /// The page as HTML. `imageUrl` must be absolute (see Links.PublicUrl) or null for no preview image;
    /// `appPath` is the route inside the app, without the scheme.
    /// </summary>
    public string Render(string title, string description, string? imageUrl, string appPath)
    {
        var appUrl = AppUrl(appPath);
        var store = config["Share:AppStoreUrl"];
        var image = string.IsNullOrWhiteSpace(imageUrl)
            ? ""
            : $"<meta property=\"og:image\" content=\"{Html.Encode(imageUrl)}\">\n<meta name=\"twitter:card\" content=\"summary_large_image\">\n";
        var storeLink = string.IsNullOrWhiteSpace(store)
            ? ""
            : $"\n<a class=\"store\" href=\"{Html.Encode(store)}\">Get FindMyParty</a>";
        var text = string.IsNullOrWhiteSpace(description) ? "" : $"\n<p>{Html.Encode(description)}</p>";

        return $"""
            <!doctype html>
            <html lang="en">
            <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>{Html.Encode(title)}</title>
            <meta property="og:type" content="website">
            <meta property="og:site_name" content="FindMyParty">
            <meta property="og:title" content="{Html.Encode(title)}">
            <meta property="og:description" content="{Html.Encode(description)}">
            {image}<style>{Style}</style>
            </head>
            <body>
            <main>
            <h1>{Html.Encode(title)}</h1>{text}
            <a class="open" href="{Html.Encode(appUrl)}">Open in FindMyParty</a>{storeLink}
            </main>
            <script>window.location.replace({JsonSerializer.Serialize(appUrl)});</script>
            </body>
            </html>
            """;
    }

    /// <summary>The plain page for a link that leads nowhere (send it with status 404).</summary>
    public string NotFound() => $"""
        <!doctype html>
        <html lang="en">
        <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Not found</title>
        <style>{Style}</style>
        </head>
        <body>
        <main>
        <h1>This link does not lead anywhere.</h1>
        <p>It may have been removed.</p>
        </main>
        </body>
        </html>
        """;

    /// <summary>Wraps a rendered page for a controller: `return SharePage.Result(share.Render(...));`.</summary>
    public static ContentResult Result(string html, int status = StatusCodes.Status200OK) =>
        new() { Content = html, ContentType = "text/html; charset=utf-8", StatusCode = status };
}
