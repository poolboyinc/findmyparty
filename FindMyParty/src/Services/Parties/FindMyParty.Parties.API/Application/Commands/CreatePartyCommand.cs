using FindMyParty.Parties.API.Application.DTOs;

namespace FindMyParty.Parties.API.Application.Commands
{
    public record CreatePartyCommand(
        Guid HostId,
        CreatePartyRequest Request);
}
