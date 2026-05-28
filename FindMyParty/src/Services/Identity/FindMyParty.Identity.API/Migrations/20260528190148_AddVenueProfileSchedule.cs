using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FindMyParty.Identity.API.Migrations
{
    /// <inheritdoc />
    public partial class AddVenueProfileSchedule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "WorkingDays",
                table: "VenueProfiles",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<TimeOnly>(
                name: "WorkingHoursClose",
                table: "VenueProfiles",
                type: "time without time zone",
                nullable: true);

            migrationBuilder.AddColumn<TimeOnly>(
                name: "WorkingHoursOpen",
                table: "VenueProfiles",
                type: "time without time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "WorkingDays",
                table: "VenueProfiles");

            migrationBuilder.DropColumn(
                name: "WorkingHoursClose",
                table: "VenueProfiles");

            migrationBuilder.DropColumn(
                name: "WorkingHoursOpen",
                table: "VenueProfiles");
        }
    }
}
