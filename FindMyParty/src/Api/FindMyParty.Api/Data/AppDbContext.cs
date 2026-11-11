using FindMyParty.Api.Bookings;
using FindMyParty.Api.Identity;
using FindMyParty.Api.Parties;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace FindMyParty.Api.Data;

/// <summary>
/// One database for everything, so a booking and its spots change in one transaction.
/// This file does not grow: a new table is an entity class plus an IEntityTypeConfiguration next to it
/// (found automatically below), read with db.Set&lt;T&gt;().
/// </summary>
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
        builder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
