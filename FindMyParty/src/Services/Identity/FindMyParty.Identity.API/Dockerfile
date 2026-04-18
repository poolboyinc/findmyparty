FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src

# Copy csproj files for restore layer caching
COPY BuildingBlocks/FindMyParty.ServiceDefaults/FindMyParty.ServiceDefaults.csproj BuildingBlocks/FindMyParty.ServiceDefaults/
COPY Services/Identity/FindMyParty.Identity.API/FindMyParty.Identity.API.csproj Services/Identity/FindMyParty.Identity.API/
RUN dotnet restore Services/Identity/FindMyParty.Identity.API/FindMyParty.Identity.API.csproj

# Copy source and publish
COPY BuildingBlocks/FindMyParty.ServiceDefaults/ BuildingBlocks/FindMyParty.ServiceDefaults/
COPY Services/Identity/FindMyParty.Identity.API/ Services/Identity/FindMyParty.Identity.API/
RUN dotnet publish Services/Identity/FindMyParty.Identity.API/FindMyParty.Identity.API.csproj -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:${PORT:-8080}
ENTRYPOINT ["dotnet", "FindMyParty.Identity.API.dll"]
