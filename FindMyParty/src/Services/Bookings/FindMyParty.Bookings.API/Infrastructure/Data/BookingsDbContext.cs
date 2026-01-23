using FindMyParty.Bookings.API.Domain.Aggregates;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Reflection.Emit;

namespace FindMyParty.Bookings.API.Infrastructure.Data
{
    public class BookingsDbContext : DbContext
    {
        public BookingsDbContext(DbContextOptions<BookingsDbContext> options)
            : base(options)
        {
        }

        public DbSet<Booking> Bookings => Set<Booking>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Booking>(entity =>
            {
                entity.HasKey(b => b.Id);

                entity.Property(b => b.Status)
                      .HasConversion<int>()
                      .IsRequired();

                entity.Property(b => b.TotalPrice)
                      .HasPrecision(18, 2);

                entity.Property(b => b.CreatedAt)
                      .IsRequired();

                // Future-proofing for concurrency
                entity.Property<byte[]>("RowVersion")
                      .IsRowVersion();

                entity.HasIndex(b => new { b.UserId, b.IdempotencyKey })
                      .IsUnique();

            });
        }
    }
}
