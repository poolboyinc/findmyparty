using FindMyParty.Parties.API.Application.IntegrationEvents;
using FindMyParty.Parties.API.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Reflection.Emit;

namespace FindMyParty.Parties.API.Infrastructure.Data
{
    public class PartiesDbContext : DbContext
    {
        public PartiesDbContext(DbContextOptions<PartiesDbContext> options)
            : base(options)
        {
        }

        public DbSet<Party> Parties => Set<Party>();

        public DbSet<ProcessedEvent> ProcessedEvents => Set<ProcessedEvent>();


        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Party>(entity =>
            {
                entity.HasKey(p => p.Id);
                entity.Property(p => p.Title).IsRequired().HasMaxLength(200);
                entity.Property(p => p.Price).HasPrecision(10, 2);
            });

            modelBuilder.Entity<ProcessedEvent>()
                .HasIndex(e => new { e.Id, e.EventType })
                .IsUnique();
        }
    }
}
