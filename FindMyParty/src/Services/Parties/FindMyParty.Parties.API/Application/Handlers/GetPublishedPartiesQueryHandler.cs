using FindMyParty.Parties.API.Application.DTOs;
using FindMyParty.Parties.API.Application.Queries;
using FindMyParty.Parties.API.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using System.Text.Json;

namespace FindMyParty.Parties.API.Application.Handlers
{
    public class GetPublishedPartiesQueryHandler(PartiesDbContext db, IDistributedCache cache)
    {
        public async Task<List<PartyResponse>> Handle(GetPublishedPartiesQuery query)
        {
            // Round coordinates to ~1 km precision to improve cache hit rate
            var latKey = query.Latitude.HasValue ? Math.Round(query.Latitude.Value, 2).ToString() : "any";
            var lngKey = query.Longitude.HasValue ? Math.Round(query.Longitude.Value, 2).ToString() : "any";
            var cacheKey = $"parties:list:{latKey}:{lngKey}:{query.Page}:{query.PageSize}";

            var cached = await cache.GetStringAsync(cacheKey);
            if (cached != null)
                return JsonSerializer.Deserialize<List<PartyResponse>>(cached)!;

            var result = await db.Parties
                .Where(p => p.Status == Domain.Enums.PartyStatus.Published && !p.IsDeleted)
                .OrderBy(p => p.StartsAt)
                .Skip((query.Page - 1) * query.PageSize)
                .Take(query.PageSize)
                .Select(p => new PartyResponse
                {
                    Id = p.Id,
                    Title = p.Title,
                    Price = p.Price,
                    StartsAt = p.StartsAt,
                    Latitude = p.Latitude,
                    Longitude = p.Longitude,
                    IsSoldOut = p.TicketsSold >= p.Capacity
                })
                .ToListAsync();

            await cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(result),
                new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(30)
                });

            return result;
        }
    }
}
