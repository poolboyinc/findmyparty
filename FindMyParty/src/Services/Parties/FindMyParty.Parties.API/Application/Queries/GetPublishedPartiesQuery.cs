namespace FindMyParty.Parties.API.Application.Queries
{
    public record GetPublishedPartiesQuery(
        double? Latitude,
        double? Longitude,
        DateOnly? Date,
        int Page,
        int PageSize);
}
