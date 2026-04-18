FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src

# Copy csproj files for restore layer caching
COPY BuildingBlocks/FindMyParty.ServiceDefaults/FindMyParty.ServiceDefaults.csproj BuildingBlocks/FindMyParty.ServiceDefaults/
COPY Services/Parties/FindMyParty.Parties.API/FindMyParty.Parties.API.csproj Services/Parties/FindMyParty.Parties.API/
RUN dotnet restore Services/Parties/FindMyParty.Parties.API/FindMyParty.Parties.API.csproj

# Copy source and publish
COPY BuildingBlocks/FindMyParty.ServiceDefaults/ BuildingBlocks/FindMyParty.ServiceDefaults/
COPY Services/Parties/FindMyParty.Parties.API/ Services/Parties/FindMyParty.Parties.API/
RUN dotnet publish Services/Parties/FindMyParty.Parties.API/FindMyParty.Parties.API.csproj -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:${PORT:-8080}
ENTRYPOINT ["dotnet", "FindMyParty.Parties.API.dll"]
