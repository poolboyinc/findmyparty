using FindMyParty.Bookings.API.Domain.Aggregates;
using FindMyParty.Bookings.API.Infrastructure.Outbox;
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
        public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();


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

                entity.Property<uint>("xmin")
                      .HasColumnType("xid")
                      .ValueGeneratedOnAddOrUpdate()
                      .IsConcurrencyToken();

                entity.HasIndex(b => new { b.UserId, b.IdempotencyKey })
                      .IsUnique();


            });
            modelBuilder.Entity<OutboxMessage>(entity =>
            {
                entity.HasKey(o => o.Id);
                entity.Property(o => o.Type).IsRequired();
                entity.Property(o => o.Payload).IsRequired();
                entity.Property(o => o.OccurredOnUtc).IsRequired();
            });

        }
    }
}
