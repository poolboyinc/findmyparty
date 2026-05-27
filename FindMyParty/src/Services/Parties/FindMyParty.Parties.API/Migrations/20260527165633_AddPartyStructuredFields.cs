using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FindMyParty.Parties.API.Migrations
{
    /// <inheritdoc />
    public partial class AddPartyStructuredFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "Featured",
                table: "Parties",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Genre",
                table: "Parties",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PerformerName",
                table: "Parties",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PerformerType",
                table: "Parties",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Featured",
                table: "Parties");

            migrationBuilder.DropColumn(
                name: "Genre",
                table: "Parties");

            migrationBuilder.DropColumn(
                name: "PerformerName",
                table: "Parties");

            migrationBuilder.DropColumn(
                name: "PerformerType",
                table: "Parties");
        }
    }
}
