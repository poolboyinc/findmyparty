namespace FindMyParty.Parties.API.Application.Commands
{
    public record CancelPartyCommand(Guid PartyId, Guid HostId);
}
