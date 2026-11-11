using System.Net;
using System.Net.Http.Json;
using FindMyParty.Api.Identity;
using FindMyParty.Api.Signs;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace FindMyParty.Api.Tests;

/// <summary>Things that only hold once the feature packages are together.</summary>
[Collection("api")]
public class MergeTests(TestApp app)
{
    private record Problem(string Title, string Code);

    [Fact]
    public async Task A_Google_user_whose_name_has_accents_gets_an_account()
    {
        var email = $"{Guid.NewGuid():N}@example.test";
        var token = "g-" + Guid.NewGuid();
        app.ExternalAuth.Tokens[token] = new ExternalIdentity(email, "g-" + Guid.NewGuid(), "Mila Perić Đukić", EmailVerified: true);

        var response = await app.CreateClient().PostAsJsonAsync("/api/auth/external", new { provider = "google", idToken = token });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var name = await app.WithDb(db => db.Users.Where(u => u.Email == email).Select(u => u.UserName).SingleAsync());
        Assert.StartsWith("MilaPericDjukic", name);
    }

    [Theory]
    [InlineData("Mila Perić", "Mila Peric")]
    [InlineData("Šćepan Žarković", "Scepan Zarkovic")]
    [InlineData("Đorđe", "Djordje")]
    [InlineData("Lena K", "Lena K")]
    public void Accents_come_off_user_names(string given, string expected) =>
        Assert.Equal(expected, AuthController.Ascii(given));

    [Fact]
    public async Task A_banned_account_is_told_it_is_closed_not_that_its_password_was_wrong()
    {
        var user = await app.UserAsync();
        await app.WithDb(db => db.Users.Where(u => u.Id == user.Id.ToString())
            .ExecuteUpdateAsync(set => set.SetProperty(u => u.LockoutEnd, new DateTimeOffset(9999, 12, 31, 0, 0, 0, TimeSpan.Zero))));

        var response = await app.CreateClient().PostAsJsonAsync("/api/auth/login", new { email = user.Email, password = Actor.DefaultPassword });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("account_closed", (await response.Content.ReadFromJsonAsync<Problem>())!.Code);
    }

    [Fact]
    public void The_sign_card_learns_a_perks_cost_from_Glow()
    {
        using var scope = app.Services.CreateScope();
        Assert.IsType<FindMyParty.Api.Glow.GlowSignPerkCosts>(scope.ServiceProvider.GetRequiredService<ISignPerkCosts>());
    }
}
