using FindMyParty.Parties.API.Application.DTOs;

namespace FindMyParty.Parties.API.Application.Commands
{
    public record UpdatePartyCommand(Guid PartyId, Guid HostId, UpdatePartyRequest Request);
}
