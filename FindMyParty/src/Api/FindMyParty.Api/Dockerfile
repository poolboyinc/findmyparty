# Build context: this folder (FindMyParty/src/Api/FindMyParty.Api)
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY FindMyParty.Api.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0
# City time (nights, weekends, "before midnight") needs the time zone data. The image has it today;
# should a later base image drop it, the build fails here instead of the first scan failing in production.
RUN test -e /usr/share/zoneinfo/Europe/Podgorica
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
# Railway provides PORT at run time; fall back to 8080 locally.
ENTRYPOINT ["sh", "-c", "ASPNETCORE_URLS=http://+:${PORT:-8080} exec dotnet FindMyParty.Api.dll"]
