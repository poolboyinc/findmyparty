FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src

COPY ["FindMyParty.Bookings.API.csproj", "."]
RUN dotnet restore "FindMyParty.Bookings.API.csproj"

COPY . .
RUN dotnet publish "FindMyParty.Bookings.API.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "FindMyParty.Bookings.API.dll"]
