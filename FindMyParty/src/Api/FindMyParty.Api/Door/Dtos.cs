namespace FindMyParty.Api.Door;

public record DoorParty(Guid Id, string Title, DateTime StartsAt, DateTime EndsAt, int Capacity, int CheckedIn);

public record DoorContext(Guid VenueId, string VenueName, string DoorName, string Role, DoorParty? Party);

public record ManifestPass(string CodeId, string Kind, string GuestName, string LevelName, int Outside, decimal PricePerGuest, List<decimal> DueByAdmit, bool SkipLine, string? PerkLabel);

public record DoorManifest(Guid PartyId, string PartyTitle, DateTime GeneratedAt, int Capacity, int CheckedIn, List<ManifestPass> Passes);

public record DoorStaffRequest(string? Name, string? DoorName);

public record DoorStaffResponse(Guid Id, string Name, string DoorName, string UserName, DateTime CreatedAt, DateTime? LastScanAt);

public record DoorStaffCreated(Guid Id, string Name, string DoorName, string UserName, DateTime CreatedAt, DateTime? LastScanAt, string Password);

public record DoorPasswordResponse(string Password);
