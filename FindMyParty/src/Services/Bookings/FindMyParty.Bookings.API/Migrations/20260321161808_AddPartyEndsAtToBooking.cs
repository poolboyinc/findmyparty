using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FindMyParty.Bookings.API.Migrations
{
    /// <inheritdoc />
    public partial class AddPartyEndsAtToBooking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "PartyEndsAt",
                table: "Bookings",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PartyEndsAt",
                table: "Bookings");
        }
    }
}
