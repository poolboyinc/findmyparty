import { Stack } from 'expo-router';

/**
 * Host-portal stack. Entry is `/admin/login` (via the 1.5s long-press on the
 * welcome logo). `/admin` resolves to the `(tabs)` group (Home dashboard) — the
 * post-login target. `party-bookings` / `edit-profile` push normally; `create`
 * is presented as a modal so the center "+" in the tab bar slides Create up over
 * the tabs rather than navigating away from them. `edit` is likewise a modal,
 * reached only from the Manage tab's per-draft action menu.
 *
 * NOTE: there is intentionally no `app/admin/index.tsx` — it would collide with
 * `app/admin/(tabs)/index.tsx` (both map to `/admin`) and was the cause of a
 * post-login redirect landing on a dead "Jump In" splash instead of the dashboard.
 */
export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="party-bookings" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="create" options={{ presentation: 'modal' }} />
      <Stack.Screen name="edit" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
