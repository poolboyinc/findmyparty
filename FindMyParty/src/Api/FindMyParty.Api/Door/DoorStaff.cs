using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FindMyParty.Api.Door;

/// <summary>A venue's door login: an account with role Door that may scan at this venue only, under its door name.</summary>
public class DoorStaff
{
    public Guid Id { get; set; }
    public Guid VenueId { get; set; }
    public string UserId { get; set; } = default!;
    /// <summary>Who holds the login, e.g. "Marko".</summary>
    public string Name { get; set; } = default!;
    /// <summary>What scans are recorded under, e.g. "Door 1".</summary>
    public string DoorName { get; set; } = default!;
    public DateTime CreatedAt { get; set; }
    public DateTime? RevokedAt { get; set; }
}

public class DoorStaffConfig : IEntityTypeConfiguration<DoorStaff>
{
    public void Configure(EntityTypeBuilder<DoorStaff> d)
    {
        d.ToTable("DoorStaff");
        d.HasKey(x => x.Id);
        d.Property(x => x.UserId).HasMaxLength(450).IsRequired();
        d.HasIndex(x => x.UserId).IsUnique();
        d.HasIndex(x => x.VenueId);
        d.Property(x => x.Name).HasMaxLength(40).IsRequired();
        d.Property(x => x.DoorName).HasMaxLength(40).IsRequired();
    }
}
