# FindMyParty — Session Context & Handoff

> Continuity doc capturing a long working session (pipeline audit → consumer screen redesigns → a Railway incident + backend resilience fix → full host-portal rebuild). Read this first when resuming.

_Last updated: 2026-05 session. Working dir: `FindMyParty/src/Clients/FindMyParty.MobileApp`._

---

## 1. Project snapshot
- **App:** FindMyParty — premium iOS-first party-discovery app. Expo SDK 54 / RN 0.81 / expo-router 6, TypeScript strict, Mapbox (`@rnmapbox/maps`), SecureStore, Reanimated 4, `@gorhom/bottom-sheet`, `react-native-gesture-handler`.
- **Backend:** .NET 8/10 microservices behind a YARP gateway — **Identity / Parties / Bookings / Payments** — PostgreSQL (EF Core), Redis, RabbitMQ, S3. Deployed on **Railway**. Payments is an empty scaffold (intentional dummy for now).
- **Design system:** `app/theme/index.ts` is the single source of truth. Dark / near-black, purple `#9D6BFF` accent, gradient reserved for logo/hero only. Theme tokens always — the old `s/vs/ms` responsive helper (`constants/responsive`) is being retired.

### Branches (important)
- **`ios-design-test`** — the working branch. **Essentially all of this session's work lives here, much of it uncommitted.**
- **`home-pc-setup`** — the branch **Railway deploys from**. To ship: commit on `ios-design-test` → **merge into `home-pc-setup`** → Railway redeploys.
- `master` — repo default.
- ⚠️ A whole debugging saga (services 504ing) was ultimately caused by **Railway deploying `home-pc-setup` while the work was on `ios-design-test`**. Remember the two-branch deploy flow.

---

## 2. The agent pipeline (how we work)
Custom agents in `.claude/agents/`:
- **design-reviewer** — HIG/design critique, no code.
- **screen-builder** — implements screens (plans first, then builds).
- **animation-specialist** — Reanimated + haptics. (Note: its tool grant lacks Bash, so the parent runs `tsc` after it.)
- **code-reviewer** — final gate on frontend diffs.
- **dotnet-reviewer** — backend (.NET/EF) diff review. **Created this session.**

Slash commands in `.claude/commands/`: `/redesign-screen`, `/critique`, `/add-animation`.

**Standard flow:** design-reviewer (critique) → user approves → screen-builder (plan → approve → build) → animation-specialist → code-reviewer. Backend: implement directly + dotnet-reviewer.

**Gotcha:** `SendMessage` (continue-an-agent) is NOT available in this environment — each agent dispatch is a fresh agent, so prompts must be fully self-contained.

---

## 3. What shipped this session

### Pipeline fixes
- Moved 3 misfiled slash-command files out of `.claude/agents/` into `.claude/commands/`.
- Fixed stale `src/theme` → `app/theme` path in `screen-builder.md`.
- Added the `dotnet-reviewer` agent.

### Consumer screens (all on `ios-design-test`)
- **Map popup card → `components/ui/party-peek-sheet.tsx`** (NEW) — rebuilt the floating card as a `@gorhom/bottom-sheet` (detents, swipe-dismiss, dark glass, whole-card-tap→detail, map camera pans to keep pin visible). Tapping through now dismisses the sheet.
- **Party detail `app/party/[id].tsx`** — Mapbox **static-map snapshot** + reverse-geocoded "District, City" (replaced raw lat/long), pinned "Get Tickets" glass CTA, ticket picker → bottom sheet, **hero parallax + stretchy header**, booking/stepper haptics, € currency.
- **Profile `app/(tabs)/profile.tsx`** — real home: cut stub rows, Help→mailto, Premium upsell card (Free state), 2-col stats, hero tightened, **functional Delete Account** (new backend endpoint), tokenized.
- **`app/favorites.tsx`** (NEW) — favorites list with row exit + staggered entry.
- **Nav bar** — `layout.floatingTabBarBottomOffset` lowered `12 → 2`.
- **Services** — removed `Alert.alert` from `bookingService`/`partyService` (services no longer pop UI; callers own error UX).

### Backend (Parties/Identity/Bookings)
- **Delete-account:** `DELETE /api/auth/account` on Identity (`AuthController`) — hard-delete, audit-logged, sanitized errors.
- **Resilience fix (Parties + Bookings):** `EnableRetryOnFailure` on the Npgsql DbContext, `BackgroundServiceExceptionBehavior = Ignore`, and try/catch around startup `MigrateAsync` + the `OutboxProcessorService` loop. **Root problem it fixed:** a transient Postgres blip crashed a `BackgroundService`, which (default `StopHost`) took the whole service down → gateway 504s. Now a DB blip can't nuke a service.
- **Structured Party fields:** added `Genre`, `PerformerName`, `PerformerType`, `Featured` to the Party model + Create/Update DTOs + handlers. Migration **`AddPartyStructuredFields`** (additive, rolling-deploy safe). Host API (`getMyParties`/`HostPartyResponse`) now returns `imageUrl` + derived `revenue` + the structured fields.

### Consumer Parties feed → real data (audit #12, DONE)
- Replaced the mock `POPPING_TONIGHT`/`NEARBY` arrays in `app/(tabs)/parties.tsx` with a real `partyService.getParties()` fetch — your **published** admin-created parties now populate the feed.
- Grouped **Tonight** (starts today) + **Upcoming**; search (title+genre) + chip filters (All / Tonight / Free Entrance / This Weekend); empty states; pull-to-refresh.
- **Backend:** enriched the consumer `PartyResponse` projection (`GetPublishedPartiesQueryHandler`) with `Genre`, `EndsAt`, `AttendeeCount` (= TicketsSold) — columns already existed, **no migration**. dotnet-reviewer approved.
- `PartyCard` dropped `distanceKm` (no GPS on this tab); meta is now `{n} going · genre · hours · price` (attendee segment hidden at 0). City picker kept but **cosmetic** (shows all parties; filtering deferred).
- ⚠️ **Product flag:** the feed exposes exact tickets-sold per party publicly ("12 going"), not just sold-out. Matches the original mock intent; bucket it ("100+") later if desired.

### Host portal rebuild — all 6 planned tasks DONE
1. **Phase 0 foundations** — shared primitives in `components/admin/`: `admin-screen`, `form-field` (FormField/FormTextArea), `picker-field`, `host-party-card` (+ StatusBadge), `stat-tile` (StatTile/SummaryStrip), plus later `modal-form-header`, `party-form` (`usePartyForm` + `PartyFormFields`), `dashboard-section-header`, `admin-tab-bar`. Nav switched from hub-and-spoke to a **tab bar** (`app/admin/(tabs)/_layout.tsx`: Home / center "+" modal / Manage).
2. **Backend structured fields** (see above).
3. **Dashboard** `app/admin/(tabs)/index.tsx` — greeting, live stats (Active/RSVPs/Revenue from `useHostDashboard`), next-up `HostPartyCard`, Account group, staggered entrance.
4. **Create-party** `app/admin/create.tsx` — real iOS form modal, structured genre/performer pickers (`ActionSheetIOS`, options in `constants/parties.ts`), Featured switch, inline validation; **TEMP DEBUG removed**; title/description no longer absorb genre/performer.
5. **Manage-parties** `app/admin/(tabs)/manage.tsx` + **real edit flow** `app/admin/edit.tsx` — extracted shared `PartyForm`/`ModalFormHeader` (create shrank 718→150), status-grouped `HostPartyCard` list, swipe + ellipsis actions, optimistic removal, "just created/edited" pulse. Prefill via `hooks/useEditPartyDraft` store.
6. **Party-bookings** `app/admin/party-bookings.tsx` — tokenized, `SummaryStrip`/`StatTile`, sectioned (active vs Cancelled), booking-status pill, entrance stagger.

---

## 4. Current state & deploy
- **Uncommitted work sits on `ios-design-test`.** tsc was green at every step.
- **To deploy:** commit → **merge `ios-design-test` → `home-pc-setup`** → Railway redeploys.
- **Migration is automatic:** the Parties service runs `await db.Database.MigrateAsync()` at startup, so `AddPartyStructuredFields` self-applies on deploy. After deploy, glance at the Parties log for a `[Startup] Database migration failed (continuing)` line — it should NOT appear (the migration is a clean additive `ADD COLUMN ×4`).
- The host dashboard/cards show **real images + revenue only once the backend is deployed**; against the old backend they safely default (placeholder image, €0) thanks to data-boundary normalization in `partyService.getMyParties`.

---

## 5. Key decisions & conventions established
- **Host portal access** = 1.5s long-press on the welcome logo → `/admin/login` (no visible button). Hosts are manually provisioned; no self-signup. (See memory `host_portal_access`.)
- **Copy:** host surfaces use "Sign In" / "Host Portal"; consumer uses "Log In". Reuse the design system; no bespoke admin styling. (Memory `admin_screen_copy_convention`.)
- **`/admin` routing:** `/admin` resolves to the `(tabs)` group (dashboard). **There must be NO `app/admin/index.tsx`** — it collides with `(tabs)/index.tsx` and caused a post-login "Jump In" splash loop (deleted this session).
- **Revenue = `TicketsSold × Price`** (derived, not stored). Exact only while price is immutable post-publish + no discounts/refunds — there's an invariant comment at the projection. If pricing changes, source from Bookings `SUM(TotalPrice)`.
- **Published status badge = purple** (`colors.tint`), not green.
- New theme token added: **`colors.brand.tintBgSolid`** (opaque highlight tint). `auth-header` gained a **`showBack`** prop.
- **Role-gate template:** the dashboard's `roleChecked` first-paint gate is the pattern for admin tab roots; modals launched from the gated tab area skip their own gate.
- **create → manage → bookings** is treated as one continuous journey (new party pulses into Manage; bookings echoes the party).

---

## 6. Outstanding / next steps
**Host portal — deferred (out of the 6-task scope):**
- **Admin Edit-Profile screen** (`app/admin/edit-profile.tsx`) NOT rebuilt — still old-style; "Save" persistence needs a backend venue-profile endpoint.
- No 3rd admin **"Profile" tab** (deferred while edit-profile is unbuilt).

**From the original launch-readiness audit (not yet addressed):**
- **City filtering on the Parties tab** — the city picker is cosmetic (shows all published parties). Real filtering needs a city/region field on parties or server-side proximity filtering. The consumer `getParties` lat/lng are currently used only for the cache key, not filtering.
- **Forgot-password** (`app/forgot-password.tsx`) still fakes success — no real email endpoint (audit #15).
- **Refresh-token DTO mismatch** (audit #26) — frontend sends `{refreshToken}`, backend `RefreshTokenRequest` expects `{UserId, RefreshToken}`. Likely still broken → silent re-login. **Verify/fix.**
- **Confirm-booking endpoint** has no role/ownership check (audit #33) — security gap.
- **Account-deletion cascade** — delete works but leaves orphaned bookings/parties (no cross-service cleanup). Hardening pass via a `UserDeleted` RabbitMQ event was deferred.
- Consumer party detail could now show the structured genre/performer (backend has them; `PartyDetail`/`getPartyById` not yet widened).

**Suggested follow-ups (non-blocking, from reviewers):**
- Promote incident-path logs from `Console.WriteLine` → `ILogger.LogError/LogCritical` in `OutboxProcessorService` + the startup migration catch (so the next blip is diagnosable).
- Consider extracting the consumer `[id].tsx` ticket sheet; pre-existing legacy `Animated` API + theme drift remain in `app/(tabs)/index.tsx`'s map/marker/picker chrome (out of redesign scope).

---

## 7. Persistent memory files
Under `~/.claude/projects/.../memory/`: `project_overview`, `host_portal_access`, `admin_screen_copy_convention`, `agent_pipeline_gaps` (known agent fixes: animation-specialist needs Bash, no verify-screen agent, etc.). `MEMORY.md` indexes them.

---

## 8. Quick resume checklist
1. Confirm branch: `git rev-parse --abbrev-ref HEAD` → expect `ios-design-test`.
2. `npx tsc --noEmit` should be clean.
3. If deploying: commit → merge to `home-pc-setup` → watch Parties deploy log for the migration line.
4. Pick up from §6 (consumer feed, forgot-password, refresh-token bug, admin edit-profile) — or whatever's next.
5. Use `npx expo start -c` (clean cache) after route changes.
