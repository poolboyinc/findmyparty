namespace FindMyParty.Parties.API.Application.Commands
{
    public record DeletePartyCommand(Guid PartyId, Guid HostId);
}
