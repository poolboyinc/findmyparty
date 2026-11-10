using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace FindMyParty.Api.Common;

/// <summary>A failure the client caused or can act on. Becomes a ProblemDetails response with this status.</summary>
public class ApiException(int status, string title, string code) : Exception(title)
{
    public int Status { get; } = status;
    public string Code { get; } = code;
    /// <summary>Extra fields for the problem body, e.g. when a pass was first used.</summary>
    public Dictionary<string, object?> Extra { get; } = [];

    public ApiException With(string key, object? value)
    {
        Extra[key] = value;
        return this;
    }

    public static ApiException NotFound(string what) => new(StatusCodes.Status404NotFound, $"{what} not found.", "not_found");
    public static ApiException Forbidden(string title = "You are not allowed to do that.") => new(StatusCodes.Status403Forbidden, title, "forbidden");
    public static ApiException Conflict(string title, string code) => new(StatusCodes.Status409Conflict, title, code);
    public static ApiException Invalid(string title, string code = "invalid") => new(StatusCodes.Status400BadRequest, title, code);
}

/// <summary>Turns ApiException into a ProblemDetails body. Anything else stays a 500 and is logged.</summary>
public class ApiExceptionHandler(IProblemDetailsService problemDetails) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        if (exception is not ApiException api) return false;

        context.Response.StatusCode = api.Status;
        var problem = new ProblemDetails { Status = api.Status, Title = api.Message };
        problem.Extensions["code"] = api.Code;
        foreach (var (key, value) in api.Extra) problem.Extensions[key] = value;
        return await problemDetails.TryWriteAsync(new ProblemDetailsContext { HttpContext = context, ProblemDetails = problem });
    }
}
