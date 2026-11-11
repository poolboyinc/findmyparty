import type { Href } from 'expo-router';

// Where the screens added in build 3 live, for `router.push(routes.friends)` and `<Link href={routes.saved}>`.
//
// Why this file: typed routes are on (app.json `experiments.typedRoutes`), and the route types in
// `.expo/types/router.d.ts` only know screens whose file existed when they were last generated. A path to
// a screen another package is still writing does not type-check as a plain string. These are cast once,
// here, so no screen needs its own `as Href`. `npx expo customize tsconfig.json` regenerates the types
// (it does not start the app); once every screen exists the casts can go.

const to = (path: string) => path as Href;
const part = encodeURIComponent;

export const routes = {
  // account (M1)
  resetPassword: (token: string) => to(`/reset-password?token=${part(token)}`),
  settings: to('/settings'),
  editProfile: to('/edit-profile'),

  // finding (M2)
  saved: to('/saved'),

  // pass and night (M3)
  pass: to('/(tabs)/pass'),
  guestPass: (token: string) => to(`/guest-pass/${part(token)}`),
  night: (date: string) => to(`/night/${part(date)}`),
  recap: (token: string) => to(`/recap/${part(token)}`),

  // glow (M4)
  perk: (id: string) => to(`/perk/${part(id)}`),

  // people (M5)
  friends: to('/friends'),
  friendSearch: to('/friend-search'),
  invite: (handle: string) => to(`/invite/${part(handle)}`),

  // the map (lead): BUILD-3-SPEC §3.5 route params on the City tab
  walkTo: (venueId: string): Href => ({ pathname: '/(tabs)', params: { walkTo: venueId } }),
  venueOnMap: (venueId: string): Href => ({ pathname: '/(tabs)', params: { venue: venueId } }),
  friendsOnMap: { pathname: '/(tabs)', params: { layer: 'friends' } } satisfies Href,

  // host (M6, M7, M8)
  hostVenue: to('/admin/venue'),
  doorStaff: to('/admin/door-staff'),
  promote: to('/admin/promote'),
  signArtwork: to('/admin/sign-artwork'),
  review: to('/admin/review'),
} as const;
