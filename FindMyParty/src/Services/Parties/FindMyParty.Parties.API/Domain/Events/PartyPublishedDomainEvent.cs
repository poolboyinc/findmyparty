namespace FindMyParty.Parties.API.Domain.Events
{
    public record PartyPublishedDomainEvent(Guid PartyId) : IDomainEvent;
}
