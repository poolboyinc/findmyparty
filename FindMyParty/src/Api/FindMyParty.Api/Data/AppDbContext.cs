using FindMyParty.Api.Bookings;
using FindMyParty.Api.Identity;
using FindMyParty.Api.Parties;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Data;

/// <summary>One database for users, venues, parties and bookings, so a booking and its spots change in one transaction.</summary>
public class AppDbContext(DbContextOptions<AppDbContext> options) : IdentityDbContext<ApplicationUser>(options)
{
    public DbSet<VenueProfile> VenueProfiles => Set<VenueProfile>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Party> Parties => Set<Party>();
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<CheckIn> CheckIns => Set<CheckIn>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<VenueProfile>(v =>
        {
            v.HasKey(x => x.Id);
            v.Property(x => x.VenueName).HasMaxLength(200).IsRequired();
            v.Property(x => x.Address).HasMaxLength(500).IsRequired();
            v.Property(x => x.WorkingDays).HasMaxLength(50);
            v.HasOne(x => x.User).WithOne().HasForeignKey<VenueProfile>(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            v.HasIndex(x => x.UserId).IsUnique(); // one venue per host
        });

        builder.Entity<RefreshToken>(t =>
        {
            t.HasKey(x => x.Id);
            t.Property(x => x.TokenHash).HasMaxLength(64).IsRequired();
            t.HasIndex(x => x.TokenHash).IsUnique();
            t.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<Party>(p =>
        {
            p.HasKey(x => x.Id);
            p.Property(x => x.Title).IsRequired().HasMaxLength(200);
            p.Property(x => x.Description).IsRequired().HasMaxLength(4000);
            p.Property(x => x.Price).HasPrecision(10, 2);
            p.Property(x => x.Genre).HasMaxLength(100);
            p.Property(x => x.PerformerName).HasMaxLength(100);
            p.Property(x => x.PerformerType).HasMaxLength(100);
            p.HasIndex(x => new { x.Status, x.EndsAt });
            p.HasIndex(x => x.HostId);
            p.HasIndex(x => x.VenueId);
            // Last line of defence: the database itself refuses to oversell.
            p.ToTable(t => t.HasCheckConstraint("CK_Parties_TicketsSold", "\"TicketsSold\" >= 0 AND \"TicketsSold\" <= \"Capacity\""));
        });

        builder.Entity<Booking>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.Status).HasConversion<int>().IsRequired();
            b.Property(x => x.TotalPrice).HasPrecision(18, 2);
            b.Property(x => x.IdempotencyKey).HasMaxLength(100).IsRequired();
            b.HasIndex(x => new { x.UserId, x.IdempotencyKey }).IsUnique();
            b.HasIndex(x => x.PartyId);
            b.Property(x => x.PassSecret).HasMaxLength(64).IsRequired();
            b.ToTable(t => t.HasCheckConstraint("CK_Bookings_CheckedIn", "\"CheckedInCount\" >= 0 AND \"CheckedInCount\" <= \"TicketCount\""));
        });

        builder.Entity<CheckIn>(c =>
        {
            c.HasKey(x => x.Id);
            c.HasIndex(x => new { x.PartyId, x.At });
            c.HasIndex(x => x.BookingId);
        });
    }
}
