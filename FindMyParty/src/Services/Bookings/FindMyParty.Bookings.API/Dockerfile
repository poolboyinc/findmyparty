FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src

# Copy csproj files for restore layer caching
COPY BuildingBlocks/FindMyParty.ServiceDefaults/FindMyParty.ServiceDefaults.csproj BuildingBlocks/FindMyParty.ServiceDefaults/
COPY Services/Bookings/FindMyParty.Bookings.API/FindMyParty.Bookings.API.csproj Services/Bookings/FindMyParty.Bookings.API/
RUN dotnet restore Services/Bookings/FindMyParty.Bookings.API/FindMyParty.Bookings.API.csproj

# Copy source and publish
COPY BuildingBlocks/FindMyParty.ServiceDefaults/ BuildingBlocks/FindMyParty.ServiceDefaults/
COPY Services/Bookings/FindMyParty.Bookings.API/ Services/Bookings/FindMyParty.Bookings.API/
RUN dotnet publish Services/Bookings/FindMyParty.Bookings.API/FindMyParty.Bookings.API.csproj -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:${PORT:-8080}
ENTRYPOINT ["dotnet", "FindMyParty.Bookings.API.dll"]
