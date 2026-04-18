FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy csproj files for restore layer caching
COPY BuildingBlocks/FindMyParty.ServiceDefaults/FindMyParty.ServiceDefaults.csproj BuildingBlocks/FindMyParty.ServiceDefaults/
COPY Gateway/FindMyParty.ApiGateway/FindMyParty.ApiGateway.csproj Gateway/FindMyParty.ApiGateway/
RUN dotnet restore Gateway/FindMyParty.ApiGateway/FindMyParty.ApiGateway.csproj

# Copy source and publish
COPY BuildingBlocks/FindMyParty.ServiceDefaults/ BuildingBlocks/FindMyParty.ServiceDefaults/
COPY Gateway/FindMyParty.ApiGateway/ Gateway/FindMyParty.ApiGateway/
RUN dotnet publish Gateway/FindMyParty.ApiGateway/FindMyParty.ApiGateway.csproj -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:${PORT:-8080}
ENTRYPOINT ["dotnet", "FindMyParty.ApiGateway.dll"]
