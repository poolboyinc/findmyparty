using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FindMyParty.Api.Friends;

/// <summary>Someone reported someone. Stays "open" until the platform admin acts on it.</summary>
public class UserReport
{
    public static readonly string[] Reasons = ["harassment", "fakeProfile", "spam", "other"];
    public static readonly string[] Actions = ["dismiss", "suspendSharing", "ban"];
    public const string Open = "open";
    public const string Resolved = "resolved";

    public Guid Id { get; set; }
    public Guid ReporterId { get; set; }
    public Guid ReportedUserId { get; set; }
    public string Reason { get; set; } = default!;
    public string? Note { get; set; }
    public string Status { get; set; } = Open;
    public string? Action { get; set; }
    public Guid? ResolvedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
}

public class UserReportConfig : IEntityTypeConfiguration<UserReport>
{
    public void Configure(EntityTypeBuilder<UserReport> r)
    {
        r.HasKey(x => x.Id);
        r.Property(x => x.Reason).HasMaxLength(20).IsRequired();
        r.Property(x => x.Note).HasMaxLength(500);
        r.Property(x => x.Status).HasMaxLength(10).IsRequired();
        r.Property(x => x.Action).HasMaxLength(20);
        r.HasIndex(x => x.Status);
        r.HasIndex(x => new { x.ReporterId, x.CreatedAt });
        r.HasIndex(x => x.ReportedUserId);
    }
}
