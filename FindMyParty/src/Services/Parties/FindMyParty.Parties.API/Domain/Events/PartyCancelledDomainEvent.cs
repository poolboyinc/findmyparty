namespace FindMyParty.Parties.API.Domain.Events
{
    public record PartyCancelledDomainEvent(Guid PartyId) : IDomainEvent;
}
