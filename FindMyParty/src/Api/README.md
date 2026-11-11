# FindMyParty API

One service, one Postgres database. It replaces the Identity, Parties and Bookings
services, the YARP gateway, RabbitMQ and Redis. Routes are unchanged
(`/api/auth`, `/api/users`, `/api/hosts`, `/api/parties`, `/api/bookings`, `/health`),
so the mobile app talks to it as before.

## Run locally

    docker compose up --build        # API on :8080, Postgres on :5432

or, with your own Postgres:

    cd FindMyParty.Api && ASPNETCORE_ENVIRONMENT=Development dotnet run

## Test

    ./run-tests.sh                   # needs Docker; starts a throwaway Postgres

## Settings (environment variables)

| Variable | Needed | What it is |
|---|---|---|
| `ConnectionStrings__DefaultConnection` | yes | Postgres connection string |
| `Jwt__Key` | yes | Long random string (32+ characters). The service refuses to start without it, or with the development key outside development. |
| `Google__ClientId` | for Google sign-in | iOS OAuth client id |
| `Apple__BundleId` | for Apple sign-in | Defaults to `com.fmpglobalinc.findmyparty` |
| `Storage__ServiceUrl`, `Storage__AccessKey`, `Storage__SecretKey`, `Storage__Bucket`, `Storage__PublicBaseUrl` | for image uploads | Any S3-compatible bucket. Without them the API runs and image uploads answer 503. |
| `Bootstrap__AdminEmail` | once | Register in the app first, set this to that email, restart: the account becomes Admin. Remove it afterwards. |
| `RateLimits__AuthPerMinute`, `RateLimits__GeneralPerMinute` | no | Default 10 and 240 |
| `Public__BaseUrl` | recommended | The API's public address, used in mails and share links (`/p`, `/v`, `/r`, `/g`, `/i`, `/reset`). Without it the request's own host is used. |
| `App__Scheme`, `Share__AppStoreUrl` | no | The app's URL scheme (default `findmypartymobileapp`) and an App Store link shown on share pages (hidden while empty). |
| `Email__ApiKey`, `Email__From`, `Email__BaseUrl` | for mail | A Resend-compatible API (password reset). Without a key, mails are only written to the log. |
| `Push__Enabled`, `Push__AccessToken` | no | Pushes go through Expo's push service (on by default; the access token only if Expo push security is switched on). |
| `Bookings__DefaultHoldMinutes`, `Door__OfflineWindowMinutes` | no | Default 90 and 15 |
| `Signs__FacadeWeekly`, `Signs__HologramWeekly`, `Signs__TonightSlot`, `Signs__TonightSlotsPerNight` | no | Sign prices in euros (40, 90, 15) and tonight slots per city (2) |
| `Seed__Demo`, `Seed__OwnerEmail`, `Seed__OwnerHistory`, `Seed__DoorPassword` | demo only | Demo city; the owner's account runs Monkey and gets nights, Glow, friends and a recap; a password for the two demo door logins (`monkey-door1`, `monkey-door2`). |
| `Database__ResetIfMismatched` | once, after a migration reset | If the database holds migrations this version does not know, the app refuses to start. With this set to `true` it drops every table and builds the database again. Remove it after that start. |

### Images on Cloudflare R2

    Storage__ServiceUrl    = https://<account-id>.r2.cloudflarestorage.com
    Storage__AccessKey     = <R2 API token access key id>
    Storage__SecretKey     = <R2 API token secret>
    Storage__Bucket        = findmyparty-images
    Storage__PublicBaseUrl = https://<your public bucket domain>      # r2.dev URL or a custom domain

## Deploy on Railway

1. Add a Postgres database to the project.
2. Create one service from this repo with root directory `FindMyParty/src/Api/FindMyParty.Api` (it has a Dockerfile).
3. Set the variables above. `ConnectionStrings__DefaultConnection` in Npgsql form:
   `Host=<host>;Port=<port>;Database=<db>;Username=<user>;Password=<password>`.
4. Give the service the public domain the app uses, then remove the old Identity, Parties,
   Bookings and gateway services, RabbitMQ and Redis.

The database schema is created on first start. Data from the old three databases is not migrated.

## Database changes

    cd FindMyParty.Api
    ASPNETCORE_ENVIRONMENT=Development dotnet ef migrations add <Name> -o Data/Migrations
