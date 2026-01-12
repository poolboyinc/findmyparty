using FindMyParty.Identity.API.Domain.Enums;
using Microsoft.AspNetCore.Identity;

namespace FindMyParty.Identity.API.Domain.Entities
{
    public class ApplicationUser : IdentityUser
    {
        public bool IsHost { get; set; }

        public SubscriptionType Subscription { get; set; } = SubscriptionType.Free;
    }
}
