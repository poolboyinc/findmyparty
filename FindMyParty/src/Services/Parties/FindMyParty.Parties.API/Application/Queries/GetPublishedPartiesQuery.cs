namespace FindMyParty.Parties.API.Application.Queries
{
    public record GetPublishedPartiesQuery(
        double? Latitude,
        double? Longitude,
        int Page,
        int PageSize);
}
