using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace FindMyParty.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class Initial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AspNetRoles",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    NormalizedName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ConcurrencyStamp = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetRoles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUsers",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    Subscription = table.Column<int>(type: "integer", nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    HomeCity = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Taste = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    GlowLifetime = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    GlowBalance = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    ShareWithFriends = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    InvisibleUntil = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SharingSuspended = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    NotifyVenues = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    NotifyFriends = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    NotifyNights = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    ReferredByUserId = table.Column<string>(type: "text", nullable: true),
                    UserName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    NormalizedUserName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    Email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    NormalizedEmail = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    EmailConfirmed = table.Column<bool>(type: "boolean", nullable: false),
                    PasswordHash = table.Column<string>(type: "text", nullable: true),
                    SecurityStamp = table.Column<string>(type: "text", nullable: true),
                    ConcurrencyStamp = table.Column<string>(type: "text", nullable: true),
                    PhoneNumber = table.Column<string>(type: "text", nullable: true),
                    PhoneNumberConfirmed = table.Column<bool>(type: "boolean", nullable: false),
                    TwoFactorEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    LockoutEnd = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    LockoutEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    AccessFailedCount = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUsers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Bookings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    PartyId = table.Column<Guid>(type: "uuid", nullable: false),
                    IdempotencyKey = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    TicketCount = table.Column<int>(type: "integer", nullable: false),
                    TotalPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PartyEndsAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CheckedInCount = table.Column<int>(type: "integer", nullable: false),
                    FirstCheckedInAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PassSecret = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    HeldUntil = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    HoldReminderSentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PerkKey = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    PerkTitle = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    PerkDiscount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false, defaultValue: 0m),
                    PerkGuests = table.Column<int>(type: "integer", nullable: false),
                    PerkValidUntil = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SkipLine = table.Column<bool>(type: "boolean", nullable: false),
                    GuestSpots = table.Column<int>(type: "integer", nullable: false),
                    GuestsIn = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Bookings", x => x.Id);
                    table.CheckConstraint("CK_Bookings_CheckedIn", "\"CheckedInCount\" >= 0 AND \"CheckedInCount\" <= \"TicketCount\"");
                    table.CheckConstraint("CK_Bookings_GuestSpots", "\"GuestsIn\" >= 0 AND \"GuestsIn\" <= \"GuestSpots\" AND \"GuestSpots\" < \"TicketCount\"");
                });

            migrationBuilder.CreateTable(
                name: "CheckIns",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BookingId = table.Column<Guid>(type: "uuid", nullable: false),
                    PartyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Admitted = table.Column<int>(type: "integer", nullable: false),
                    At = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    GuestUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    DoorName = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false, defaultValue: "Host"),
                    AmountDue = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false, defaultValue: 0m),
                    ClientScanId = table.Column<Guid>(type: "uuid", nullable: true),
                    GuestPassId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CheckIns", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Cities",
                columns: table => new
                {
                    Slug = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Latitude = table.Column<double>(type: "double precision", nullable: false),
                    Longitude = table.Column<double>(type: "double precision", nullable: false),
                    RadiusKm = table.Column<double>(type: "double precision", nullable: false),
                    TimeZone = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Cities", x => x.Slug);
                });

            migrationBuilder.CreateTable(
                name: "DoorStaff",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    VenueId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "character varying(450)", maxLength: 450, nullable: false),
                    Name = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    DoorName = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RevokedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DoorStaff", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FriendRequestLog",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FromUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ToUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    At = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FriendRequestLog", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Friendship",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserLowId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserHighId = table.Column<Guid>(type: "uuid", nullable: false),
                    RequestedById = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AcceptedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Friendship", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "GlowEntries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Points = table.Column<int>(type: "integer", nullable: false),
                    BookingId = table.Column<Guid>(type: "uuid", nullable: true),
                    VenueId = table.Column<Guid>(type: "uuid", nullable: true),
                    PartyId = table.Column<Guid>(type: "uuid", nullable: true),
                    ClaimId = table.Column<Guid>(type: "uuid", nullable: true),
                    At = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    NightDate = table.Column<DateOnly>(type: "date", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GlowEntries", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "GuestPasses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    BookingId = table.Column<Guid>(type: "uuid", nullable: false),
                    Token = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    PassSecret = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ClaimedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ClaimedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CheckedInAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RevokedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GuestPasses", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Parties",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    HostId = table.Column<Guid>(type: "uuid", nullable: false),
                    VenueId = table.Column<Guid>(type: "uuid", nullable: true),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    Price = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    Capacity = table.Column<int>(type: "integer", nullable: false),
                    TicketsSold = table.Column<int>(type: "integer", nullable: false),
                    StartsAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndsAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Latitude = table.Column<double>(type: "double precision", nullable: false),
                    Longitude = table.Column<double>(type: "double precision", nullable: false),
                    ImageUrl = table.Column<string>(type: "text", nullable: true),
                    Genre = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    PerformerName = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    PerformerType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Featured = table.Column<bool>(type: "boolean", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false),
                    AgeLimit = table.Column<int>(type: "integer", nullable: true),
                    HoldMinutes = table.Column<int>(type: "integer", nullable: false, defaultValue: 90)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Parties", x => x.Id);
                    table.CheckConstraint("CK_Parties_TicketsSold", "\"TicketsSold\" >= 0 AND \"TicketsSold\" <= \"Capacity\"");
                });

            migrationBuilder.CreateTable(
                name: "PasswordResets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TokenHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UsedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PasswordResets", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PerkClaims",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PerkId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    Status = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    ClaimedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RedeemedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RedeemedByUserId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PerkClaims", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PushDevices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ExpoToken = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Platform = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastSeenAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PushDevices", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RecapNotices",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    NightDate = table.Column<DateOnly>(type: "date", nullable: false),
                    SentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RecapNotices", x => new { x.UserId, x.NightDate });
                });

            migrationBuilder.CreateTable(
                name: "RecapShares",
                columns: table => new
                {
                    Token = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    NightDate = table.Column<DateOnly>(type: "date", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RecapShares", x => x.Token);
                });

            migrationBuilder.CreateTable(
                name: "SavedItems",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    TargetId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SavedItems", x => new { x.UserId, x.Kind, x.TargetId });
                });

            migrationBuilder.CreateTable(
                name: "SignBooking",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Format = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false),
                    SpotId = table.Column<Guid>(type: "uuid", nullable: true),
                    BookedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    VenueId = table.Column<Guid>(type: "uuid", nullable: true),
                    PartyId = table.Column<Guid>(type: "uuid", nullable: true),
                    PerkId = table.Column<Guid>(type: "uuid", nullable: true),
                    AdvertiserName = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Text = table.Column<string>(type: "character varying(25)", maxLength: 25, nullable: false),
                    ColorTop = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    ColorBottom = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    Ink = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    ArtworkUrl = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CardTitle = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    CardSubtitle = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    StartsOn = table.Column<DateOnly>(type: "date", nullable: false),
                    EndsOn = table.Column<DateOnly>(type: "date", nullable: false),
                    Price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    ReviewNote = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    ReviewedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    InvoiceStatus = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SignBooking", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SignHide",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    SignBookingId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SignHide", x => new { x.UserId, x.SignBookingId });
                });

            migrationBuilder.CreateTable(
                name: "SignSpot",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CitySlug = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Number = table.Column<int>(type: "integer", nullable: false),
                    Format = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Label = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    Area = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    Latitude = table.Column<double>(type: "double precision", nullable: false),
                    Longitude = table.Column<double>(type: "double precision", nullable: false),
                    BearingDeg = table.Column<double>(type: "double precision", nullable: false),
                    BaseHeightM = table.Column<double>(type: "double precision", nullable: false),
                    WidthM = table.Column<double>(type: "double precision", nullable: false),
                    HeightM = table.Column<double>(type: "double precision", nullable: false),
                    BuildingHeightM = table.Column<double>(type: "double precision", nullable: false),
                    VenueId = table.Column<Guid>(type: "uuid", nullable: true),
                    WeeklyPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    Active = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SignSpot", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SponsoredPerks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    SponsorName = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    LogoText = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    ColorTop = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    ColorBottom = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    Ink = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    VenueId = table.Column<Guid>(type: "uuid", nullable: false),
                    MinLevel = table.Column<int>(type: "integer", nullable: false),
                    GlowCost = table.Column<int>(type: "integer", nullable: false),
                    Stock = table.Column<int>(type: "integer", nullable: true),
                    StartsAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndsAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Active = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SponsoredPerks", x => x.Id);
                    table.CheckConstraint("CK_SponsoredPerks_Stock", "\"Stock\" IS NULL OR \"Stock\" >= 0");
                });

            migrationBuilder.CreateTable(
                name: "UserBlock",
                columns: table => new
                {
                    BlockerId = table.Column<Guid>(type: "uuid", nullable: false),
                    BlockedId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserBlock", x => new { x.BlockerId, x.BlockedId });
                });

            migrationBuilder.CreateTable(
                name: "UserReport",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ReporterId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReportedUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Reason = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Status = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Action = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    ResolvedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ResolvedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserReport", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "VenuePerks",
                columns: table => new
                {
                    VenueId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Enabled = table.Column<bool>(type: "boolean", nullable: false),
                    UntilLocalTime = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VenuePerks", x => new { x.VenueId, x.Kind });
                });

            migrationBuilder.CreateTable(
                name: "AspNetRoleClaims",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RoleId = table.Column<string>(type: "text", nullable: false),
                    ClaimType = table.Column<string>(type: "text", nullable: true),
                    ClaimValue = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetRoleClaims", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AspNetRoleClaims_AspNetRoles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "AspNetRoles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserClaims",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    ClaimType = table.Column<string>(type: "text", nullable: true),
                    ClaimValue = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserClaims", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AspNetUserClaims_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserLogins",
                columns: table => new
                {
                    LoginProvider = table.Column<string>(type: "text", nullable: false),
                    ProviderKey = table.Column<string>(type: "text", nullable: false),
                    ProviderDisplayName = table.Column<string>(type: "text", nullable: true),
                    UserId = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserLogins", x => new { x.LoginProvider, x.ProviderKey });
                    table.ForeignKey(
                        name: "FK_AspNetUserLogins_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserRoles",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "text", nullable: false),
                    RoleId = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserRoles", x => new { x.UserId, x.RoleId });
                    table.ForeignKey(
                        name: "FK_AspNetUserRoles_AspNetRoles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "AspNetRoles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AspNetUserRoles_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserTokens",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "text", nullable: false),
                    LoginProvider = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Value = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserTokens", x => new { x.UserId, x.LoginProvider, x.Name });
                    table.ForeignKey(
                        name: "FK_AspNetUserTokens_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RefreshTokens",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    TokenHash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RevokedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RefreshTokens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RefreshTokens_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "VenueProfiles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    VenueName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Latitude = table.Column<double>(type: "double precision", nullable: false),
                    Longitude = table.Column<double>(type: "double precision", nullable: false),
                    WorkingHoursOpen = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                    WorkingHoursClose = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                    WorkingDays = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    CitySlug = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false, defaultValue: "podgorica"),
                    Kind = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    Area = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    ImageUrl = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Footprint = table.Column<string>(type: "jsonb", nullable: true),
                    BuildingHeightM = table.Column<double>(type: "double precision", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VenueProfiles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VenueProfiles_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PartyActs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PartyId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Role = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    StartsAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Order = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PartyActs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PartyActs_Parties_PartyId",
                        column: x => x.PartyId,
                        principalTable: "Parties",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "VenueFollows",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    VenueId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VenueFollows", x => new { x.UserId, x.VenueId });
                    table.ForeignKey(
                        name: "FK_VenueFollows_VenueProfiles_VenueId",
                        column: x => x.VenueId,
                        principalTable: "VenueProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "Cities",
                columns: new[] { "Slug", "Latitude", "Longitude", "Name", "Order", "RadiusKm", "TimeZone" },
                values: new object[,]
                {
                    { "budva", 42.2911, 18.840299999999999, "Budva", 2, 12.0, "Europe/Podgorica" },
                    { "herceg-novi", 42.453099999999999, 18.537500000000001, "Herceg Novi", 6, 12.0, "Europe/Podgorica" },
                    { "kotor", 42.424700000000001, 18.7712, "Kotor", 4, 12.0, "Europe/Podgorica" },
                    { "niksic", 42.773099999999999, 18.944500000000001, "Nikšić", 3, 12.0, "Europe/Podgorica" },
                    { "podgorica", 42.441899999999997, 19.263200000000001, "Podgorica", 1, 12.0, "Europe/Podgorica" },
                    { "tivat", 42.430399999999999, 18.696200000000001, "Tivat", 5, 12.0, "Europe/Podgorica" }
                });

            migrationBuilder.CreateIndex(
                name: "IX_AspNetRoleClaims_RoleId",
                table: "AspNetRoleClaims",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "RoleNameIndex",
                table: "AspNetRoles",
                column: "NormalizedName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUserClaims_UserId",
                table: "AspNetUserClaims",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUserLogins_UserId",
                table: "AspNetUserLogins",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUserRoles_RoleId",
                table: "AspNetUserRoles",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "EmailIndex",
                table: "AspNetUsers",
                column: "NormalizedEmail");

            migrationBuilder.CreateIndex(
                name: "UserNameIndex",
                table: "AspNetUsers",
                column: "NormalizedUserName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_PartyId",
                table: "Bookings",
                column: "PartyId");

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_Status_HeldUntil",
                table: "Bookings",
                columns: new[] { "Status", "HeldUntil" });

            migrationBuilder.CreateIndex(
                name: "IX_Bookings_UserId_IdempotencyKey",
                table: "Bookings",
                columns: new[] { "UserId", "IdempotencyKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CheckIns_BookingId",
                table: "CheckIns",
                column: "BookingId");

            migrationBuilder.CreateIndex(
                name: "IX_CheckIns_ByUserId",
                table: "CheckIns",
                column: "ByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_CheckIns_ClientScanId",
                table: "CheckIns",
                column: "ClientScanId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CheckIns_GuestUserId",
                table: "CheckIns",
                column: "GuestUserId");

            migrationBuilder.CreateIndex(
                name: "IX_CheckIns_PartyId_At",
                table: "CheckIns",
                columns: new[] { "PartyId", "At" });

            migrationBuilder.CreateIndex(
                name: "IX_DoorStaff_UserId",
                table: "DoorStaff",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_DoorStaff_VenueId",
                table: "DoorStaff",
                column: "VenueId");

            migrationBuilder.CreateIndex(
                name: "IX_FriendRequestLog_FromUserId_At",
                table: "FriendRequestLog",
                columns: new[] { "FromUserId", "At" });

            migrationBuilder.CreateIndex(
                name: "IX_FriendRequestLog_ToUserId",
                table: "FriendRequestLog",
                column: "ToUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Friendship_UserHighId",
                table: "Friendship",
                column: "UserHighId");

            migrationBuilder.CreateIndex(
                name: "IX_Friendship_UserLowId_UserHighId",
                table: "Friendship",
                columns: new[] { "UserLowId", "UserHighId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GlowEntries_UserId_At",
                table: "GlowEntries",
                columns: new[] { "UserId", "At" });

            migrationBuilder.CreateIndex(
                name: "IX_GlowEntries_UserId_BookingId_Kind",
                table: "GlowEntries",
                columns: new[] { "UserId", "BookingId", "Kind" },
                unique: true,
                filter: "\"BookingId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_GuestPasses_BookingId",
                table: "GuestPasses",
                column: "BookingId");

            migrationBuilder.CreateIndex(
                name: "IX_GuestPasses_ClaimedByUserId",
                table: "GuestPasses",
                column: "ClaimedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_GuestPasses_Token",
                table: "GuestPasses",
                column: "Token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Parties_HostId",
                table: "Parties",
                column: "HostId");

            migrationBuilder.CreateIndex(
                name: "IX_Parties_Status_EndsAt",
                table: "Parties",
                columns: new[] { "Status", "EndsAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Parties_VenueId",
                table: "Parties",
                column: "VenueId");

            migrationBuilder.CreateIndex(
                name: "IX_PartyActs_PartyId",
                table: "PartyActs",
                column: "PartyId");

            migrationBuilder.CreateIndex(
                name: "IX_PasswordResets_TokenHash",
                table: "PasswordResets",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PasswordResets_UserId",
                table: "PasswordResets",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_PerkClaims_PerkId_UserId",
                table: "PerkClaims",
                columns: new[] { "PerkId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PerkClaims_UserId",
                table: "PerkClaims",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_PushDevices_ExpoToken",
                table: "PushDevices",
                column: "ExpoToken",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PushDevices_UserId",
                table: "PushDevices",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_RecapShares_UserId_NightDate",
                table: "RecapShares",
                columns: new[] { "UserId", "NightDate" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_TokenHash",
                table: "RefreshTokens",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_UserId",
                table: "RefreshTokens",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_SignBooking_BookedByUserId",
                table: "SignBooking",
                column: "BookedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_SignBooking_PartyId",
                table: "SignBooking",
                column: "PartyId");

            migrationBuilder.CreateIndex(
                name: "IX_SignBooking_SpotId_StartsOn",
                table: "SignBooking",
                columns: new[] { "SpotId", "StartsOn" });

            migrationBuilder.CreateIndex(
                name: "IX_SignBooking_Status",
                table: "SignBooking",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_SignSpot_CitySlug_Format_Number",
                table: "SignSpot",
                columns: new[] { "CitySlug", "Format", "Number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SponsoredPerks_VenueId_EndsAt",
                table: "SponsoredPerks",
                columns: new[] { "VenueId", "EndsAt" });

            migrationBuilder.CreateIndex(
                name: "IX_UserBlock_BlockedId",
                table: "UserBlock",
                column: "BlockedId");

            migrationBuilder.CreateIndex(
                name: "IX_UserReport_ReportedUserId",
                table: "UserReport",
                column: "ReportedUserId");

            migrationBuilder.CreateIndex(
                name: "IX_UserReport_ReporterId_CreatedAt",
                table: "UserReport",
                columns: new[] { "ReporterId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_UserReport_Status",
                table: "UserReport",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_VenueFollows_VenueId",
                table: "VenueFollows",
                column: "VenueId");

            migrationBuilder.CreateIndex(
                name: "IX_VenueProfiles_CitySlug",
                table: "VenueProfiles",
                column: "CitySlug");

            migrationBuilder.CreateIndex(
                name: "IX_VenueProfiles_UserId",
                table: "VenueProfiles",
                column: "UserId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AspNetRoleClaims");

            migrationBuilder.DropTable(
                name: "AspNetUserClaims");

            migrationBuilder.DropTable(
                name: "AspNetUserLogins");

            migrationBuilder.DropTable(
                name: "AspNetUserRoles");

            migrationBuilder.DropTable(
                name: "AspNetUserTokens");

            migrationBuilder.DropTable(
                name: "Bookings");

            migrationBuilder.DropTable(
                name: "CheckIns");

            migrationBuilder.DropTable(
                name: "Cities");

            migrationBuilder.DropTable(
                name: "DoorStaff");

            migrationBuilder.DropTable(
                name: "FriendRequestLog");

            migrationBuilder.DropTable(
                name: "Friendship");

            migrationBuilder.DropTable(
                name: "GlowEntries");

            migrationBuilder.DropTable(
                name: "GuestPasses");

            migrationBuilder.DropTable(
                name: "PartyActs");

            migrationBuilder.DropTable(
                name: "PasswordResets");

            migrationBuilder.DropTable(
                name: "PerkClaims");

            migrationBuilder.DropTable(
                name: "PushDevices");

            migrationBuilder.DropTable(
                name: "RecapNotices");

            migrationBuilder.DropTable(
                name: "RecapShares");

            migrationBuilder.DropTable(
                name: "RefreshTokens");

            migrationBuilder.DropTable(
                name: "SavedItems");

            migrationBuilder.DropTable(
                name: "SignBooking");

            migrationBuilder.DropTable(
                name: "SignHide");

            migrationBuilder.DropTable(
                name: "SignSpot");

            migrationBuilder.DropTable(
                name: "SponsoredPerks");

            migrationBuilder.DropTable(
                name: "UserBlock");

            migrationBuilder.DropTable(
                name: "UserReport");

            migrationBuilder.DropTable(
                name: "VenueFollows");

            migrationBuilder.DropTable(
                name: "VenuePerks");

            migrationBuilder.DropTable(
                name: "AspNetRoles");

            migrationBuilder.DropTable(
                name: "Parties");

            migrationBuilder.DropTable(
                name: "VenueProfiles");

            migrationBuilder.DropTable(
                name: "AspNetUsers");
        }
    }
}
