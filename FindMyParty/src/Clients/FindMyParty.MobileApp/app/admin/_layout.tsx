import { Stack } from 'expo-router';

/**
 * Host-portal stack. The splash (`index`), `login`, the `(tabs)` group, and the
 * pushed `party-bookings` / `edit-profile` siblings push normally; `create` is
 * presented as a modal so the center "+" in the tab bar slides Create up over
 * the tabs rather than navigating away from them.
 */
export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="party-bookings" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="create" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
