namespace FindMyParty.Parties.API.Application.Cache
{
    public static class CacheKeys
    {
        public const string ListVersion = "parties:list:version";

        public static string Availability(Guid partyId) => $"parties:availability:{partyId}";
    }
}
