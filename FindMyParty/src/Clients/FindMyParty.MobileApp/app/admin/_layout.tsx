import { Stack } from 'expo-router';

/**
 * Host stack. Entry is `/admin/login` (via the 1.5s long-press on the welcome
 * logo). `/admin` resolves to the `(tabs)` group (Live, Parties, Scan, Promote,
 * Venue): the post-login target. `party-bookings`, `door-staff` and `review`
 * push normally; `create` is presented as a modal, opened by the "+" in the
 * Parties header, so it slides up over the tabs rather than navigating away from
 * them. `edit` is likewise a modal, reached only from the Parties tab's per-draft
 * action menu, and `sign-artwork` is the modal behind "Your sign" on Promote.
 *
 * NOTE: there is intentionally no `app/admin/index.tsx` — it would collide with
 * `app/admin/(tabs)/index.tsx` (both map to `/admin`) and was the cause of a
 * post-login redirect landing on a dead "Jump In" splash instead of the host tabs.
 */
export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="party-bookings" />
      <Stack.Screen name="door-staff" />
      <Stack.Screen name="review" />
      <Stack.Screen name="create" options={{ presentation: 'modal' }} />
      <Stack.Screen name="edit" options={{ presentation: 'modal' }} />
      <Stack.Screen name="sign-artwork" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
