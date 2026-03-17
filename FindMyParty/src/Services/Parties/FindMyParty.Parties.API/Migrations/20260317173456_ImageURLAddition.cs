using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FindMyParty.Parties.API.Migrations
{
    /// <inheritdoc />
    public partial class ImageURLAddition : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ImageUrl",
                table: "Parties",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ImageUrl",
                table: "Parties");
        }
    }
}
