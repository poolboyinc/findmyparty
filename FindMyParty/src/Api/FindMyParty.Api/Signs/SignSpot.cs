using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FindMyParty.Api.Signs;

/// <summary>
/// A hand-picked place for a sign: a wall (facade panel) or a roof (hologram). It stores its own geometry, so the map
/// needs nothing else to draw it. A spot with `VenueId` is that venue's own wall and only that venue books it.
/// </summary>
public class SignSpot
{
    public const string Facade = "facade";
    public const string Hologram = "hologram";

    public Guid Id { get; set; }
    public string CitySlug { get; set; } = default!;
    public int Number { get; set; }
    public string Format { get; set; } = Facade;
    /// <summary>The street, e.g. "Njegoševa".</summary>
    public string Label { get; set; } = default!;
    public string Area { get; set; } = default!;
    /// <summary>The middle of the wall at ground level (facade), or of the roof (hologram).</summary>
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    /// <summary>The way the wall faces, degrees clockwise from north.</summary>
    public double BearingDeg { get; set; }
    public double BaseHeightM { get; set; }
    public double WidthM { get; set; }
    public double HeightM { get; set; }
    public double BuildingHeightM { get; set; }
    public Guid? VenueId { get; set; }
    /// <summary>Null: the format's price from settings.</summary>
    public decimal? WeeklyPrice { get; set; }
    public bool Active { get; set; } = true;
}

public class SignSpotConfig : IEntityTypeConfiguration<SignSpot>
{
    public void Configure(EntityTypeBuilder<SignSpot> s)
    {
        s.HasKey(x => x.Id);
        s.Property(x => x.CitySlug).HasMaxLength(40).IsRequired();
        s.Property(x => x.Format).HasMaxLength(10).IsRequired();
        s.Property(x => x.Label).HasMaxLength(60).IsRequired();
        s.Property(x => x.Area).HasMaxLength(80).IsRequired();
        s.Property(x => x.WeeklyPrice).HasPrecision(18, 2);
        s.HasIndex(x => new { x.CitySlug, x.Format, x.Number }).IsUnique();
    }
}
