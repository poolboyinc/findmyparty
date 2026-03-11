namespace FindMyParty.Parties.API.Application.Commands
{
    public record PublishPartyCommand(Guid PartyId, Guid HostId);
}
