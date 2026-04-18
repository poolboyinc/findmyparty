# ULTRAVIOLET — FindMyParty Design System

Neon ultraviolet on violet-tinted obsidian. Liquid glass. Floating chrome.
Built on **Tamagui** (`tamagui.config.ts`).

## Foundations

### Palette
| Role | Token | Value |
|---|---|---|
| Primary neon | `$violet500` | `#B026FF` |
| Violet ramp | `$violet50` → `$violet950` | `#F5EBFF` → `#1F0F2E` |
| App bg (obsidian) | `$void` | `#05020A` |
| Surfaces | `$surfaceBase` / `$surfaceRaised` / `$surfaceOverlay` | `#0A0612` / `#14081F` / `#1F0F2E` |
| Cyan accent (live) | `$cyan` | `#00F5D4` |
| Magenta (urgency) | `$magenta` | `#FF2E93` |
| Sodium (rewards) | `$sodium` | `#FFB800` |
| Text | `$text` / `$textMuted` / `$textFaint` | violet-tinted whites |
| Glass borders | `$glassTop` / `$glassBottom` / `$glassFlat` | asymmetric directional light |

### Typography
- **Display (headlines, buttons)**: `Coolvetica` — already loaded via `expo-font`.
- **Body**: iOS `ui-rounded` fallback today. Add `Bricolage Grotesque` TTFs to `assets/fonts/` and the `useFonts()` map in `app/_layout.tsx` when ready.
- **Mono (prices, times, XP)**: iOS `ui-monospace` fallback. Add `Geist Mono` when ready.

### Motion
Defined in `tamagui.config.ts` under `animations`:
- **gentle / snappy / bouncy / heavy / press** — spring presets (use via `animation="snappy"`).
- **fast / base / slow / ambient** — timing presets.
- Runtime loops (breathing, drifting, shimmer, pulse) live in individual components using `react-native-reanimated`.

## Primitives

All in `components/ui/`. Always compose screens from these — never scatter blur/gradient/shadow in screen files.

### `<GlassSurface>`
The canonical liquid-glass container. Blur + violet wash + asymmetric directional highlight + variant-driven border & shadow.

```tsx
<GlassSurface
  intensity={75}            // 0–100
  washOpacity={0.14}        // violet tint strength
  tone="bright"             // 'default' | 'bright' | 'neon'
  elevation="floating"      // 'flat' | 'raised' | 'floating'
  borderRadius={32}
  padding="$lg"
>
  ...
</GlassSurface>
```

### `<NeonButton>`
Primary CTAs with neon halo, wet-glass highlight, press spring, and light haptic on touch.

```tsx
<NeonButton label="Book ticket"  variant="primary" size="lg" fullWidth />
<NeonButton label="Going live"   variant="live"    pulse />
<NeonButton label="Cancel"       variant="ghost" />
<NeonButton label="See map"      variant="chrome" leading={<MapIcon />} />
```

### `<GradientOrb>` / `<AmbientBackdrop>`
Drifting colored blobs behind content. `<AmbientBackdrop />` composes 3 orbs (violet/magenta/cyan) with staggered drift.

```tsx
<View flex={1}>
  <AmbientBackdrop variant="default" />  {/* 'subtle' | 'default' | 'intense' */}
  <YourContent />
</View>
```

## Done (this branch)
- [x] Tamagui installed + configured with ULTRAVIOLET tokens
- [x] `tamagui.config.ts` — tokens, fonts, animations, dark theme
- [x] `<GlassSurface>` — base liquid-glass container
- [x] `<NeonButton>` — primary CTA with glow + haptics + variants
- [x] `<GradientOrb>` — animated drifting/breathing blob
- [x] `<AmbientBackdrop>` — 3-orb ambient scene
- [x] Floating liquid-glass tab bar with neon halo, shimmer sweep, active dot, selection haptic
- [x] Root layout wrapped in `TamaguiProvider` + `PortalProvider`
- [x] React Navigation theme colored to match (no white flashes)

## Next — Phase 2 (hero screens)
1. **Splash** — Coolvetica logo pulsing with violet halo + slow aurora gradient sweep + "findmyparty" kerned wide. Reanimated 4-second intro.
2. **Onboarding** — 3 scenes:
   - **01 Discover** — animated map with pulsing pins (cyan)
   - **02 Book** — glass ticket sliding into wallet
   - **03 Arrive** — 3D building + confetti preview
   Each scene uses `<AmbientBackdrop />` + staggered text reveal.
3. **Login / Register** — glass card centered on ambient backdrop. Google + Apple + email fields inside `<GlassSurface>`. Errors in magenta.
4. **Explore / Map** — keep existing map, but swap the search bar + filter FAB + party card to use `<GlassSurface>`. Markers get cyan→violet animated gradient ring on hover.
5. **Party detail** — hero image with parallax + floor-to-top gradient scrim, floating glass price bar at bottom with neon "Book" CTA.
6. **Ticket wallet (`my-bookings`)** — Apple Wallet–style stack. Each ticket is a glass card with animated QR that pulses violet when tapped.
7. **Profile** — XP ring (sodium→violet gradient), badge grid, streak counter.

## Next — Phase 3 (animation polish)
- **Page entry staggers** — title, body, CTAs fade+translate up with 80ms delays using Tamagui `animation` + `enterStyle`.
- **Shared element transitions** — party card → detail page (hero image). Use `react-native-reanimated` v4 shared values + `react-navigation` v7 native stack animations.
- **Arrival reveal** — geofence trigger: map tilts to 60° + building glows + confetti + haptic `Notification.Success`.
- **Pull-to-refresh** — custom violet spinner with aurora gradient.

## Next — Phase 4 (Lottie / external animations)
Generate these in the Claude design app or LottieFiles, drop to `assets/anim/`:
1. **splash-intro.json** — Coolvetica logo writing itself, ~1.5s
2. **confetti-violet.json** — violet + magenta + cyan confetti burst, 2s one-shot
3. **ring-loading.json** — segmented violet ring rotating, loop
4. **check-stamp.json** — "YOU MADE IT" rubber stamp slam, 800ms
5. **heart-pulse.json** — outline → filled violet heart with ring bloom
6. **xp-up.json** — floating "+50 XP" sodium yellow with trail
7. **live-dot.json** — breathing magenta dot ("live now" indicator)

Mount via `lottie-react-native` (add: `npx expo install lottie-react-native`).

## Fonts to add (optional, for full typography)
Download TTFs, drop in `assets/fonts/`, register in `app/_layout.tsx` `useFonts({...})`, and swap `ui-rounded`/`ui-monospace` in `tamagui.config.ts`:
- **Bricolage Grotesque** — https://fonts.google.com/specimen/Bricolage+Grotesque (variable font, pick Regular + Bold + ExtraBold)
- **Geist Mono** — https://vercel.com/font (Regular + Medium)

## Gotchas
- **Screen content under the floating tab bar** — since the tab bar is now absolutely positioned & floating, scroll views need bottom padding of ~`vs(100)` (tab bar height ~72 + 16 margin + safe area). Grep for `paddingBottom` / `contentContainerStyle` and add this where missing.
- **Tamagui babel plugin** — not installed. Adds compile-time optimization + tree-shaking. To enable, create `babel.config.js`, add `@tamagui/babel-plugin`, and set `TAMAGUI_TARGET=native`. Skipped for now to keep baseline stable.
