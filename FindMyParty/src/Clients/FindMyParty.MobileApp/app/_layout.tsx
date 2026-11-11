import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname, useRouter, useSegments, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { QueryClientProvider, focusManager } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

import { LocalDataUpload } from '@/components/app/local-data-upload';
import { PushRegistrar } from '@/components/app/push-registrar';
import { ScanMomentHost } from '@/components/pass/scan-moment-host';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { primeHomeCity } from '@/hooks/useHomeCity';
import { authService } from '@/services/authService';
import { rememberLink, takePendingLink } from '@/services/pendingLink';
import { queryClient } from '@/services/queryClient';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

/** Open to anyone, signed in or not. `admin` guards itself (components/host/use-host-gate.ts). */
const PUBLIC_ROUTES = ['onboarding', 'login', 'register', 'forgot-password', 'reset-password', 'recap', 'admin'];

/**
 * Links that are opened from outside and need an account (`invite/[handle]`, `guest-pass/[token]`).
 * A signed-out user goes to the welcome first and is brought back here after signing in.
 */
const RETURN_ROUTES = ['invite', 'guest-pass'];

/**
 * Redirects unauthenticated users away from protected routes.
 * Runs whenever the active route changes.
 */
function useProtectedRoute() {
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const root: string | undefined = segments[0];

  useEffect(() => {
    // Don't guard while splash is still showing
    if (root === 'splash' || root === undefined) return;

    // Auth and onboarding screens are always accessible
    if (PUBLIC_ROUTES.includes(root)) {
      setChecked(true);
      return;
    }

    // For all other routes, verify authentication
    let cancelled = false;
    authService.isAuthenticated().then((authenticated) => {
      if (cancelled) return;
      if (!authenticated) {
        // Opened from a link that needs an account: remember it, so signing in leads back to it.
        if (RETURN_ROUTES.includes(root)) rememberLink(pathname);
        // The session is over: forget the last user's cached data before anyone else signs in.
        queryClient.clear();
        router.replace('/onboarding');
      } else if (root === '(tabs)') {
        // Signed in and through first run: open the link that was waiting, if there is one.
        const link = takePendingLink();
        if (link) router.push(link as Href);
      }
      setChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [root, pathname, router]);

  return checked;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  useProtectedRoute();

  // Server data refreshes when the app comes back to the front.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
    return () => sub.remove();
  }, []);

  // The phone's stored city is read before the first screen asks for a city's parties and venues.
  useEffect(() => primeHomeCity(queryClient), []);

  const [fontsLoaded] = useFonts({
    Coolvetica: require('@/assets/fonts/coolvetica.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack initialRouteName="splash">
            <Stack.Screen name="splash" options={{ headerShown: false, animation: 'none' }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
            <Stack.Screen name="login" options={{ headerShown: false, animation: 'slide_from_right' }} />
            <Stack.Screen name="register" options={{ headerShown: false, animation: 'slide_from_right' }} />
            <Stack.Screen name="forgot-password" options={{ headerShown: false, animation: 'slide_from_right' }} />
            <Stack.Screen name="reset-password" options={{ headerShown: false, animation: 'slide_from_right' }} />
            <Stack.Screen name="first-run" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false, gestureEnabled: false, animation: 'none' }} />
            <Stack.Screen name="party/[id]" options={{ headerShown: false, animation: 'slide_from_right' }} />
            <Stack.Screen name="venue/[id]" options={{ headerShown: false, animation: 'slide_from_right' }} />
            <Stack.Screen name="my-bookings" options={{ headerShown: false, animation: 'slide_from_right' }} />
            {/* `favorites` goes when package M2 replaces app/favorites.tsx with app/saved.tsx. */}
            <Stack.Screen name="favorites" options={{ headerShown: false, animation: 'slide_from_right' }} />
            <Stack.Screen name="saved" options={{ headerShown: false, animation: 'slide_from_right' }} />
            <Stack.Screen name="settings" options={{ headerShown: false, animation: 'slide_from_right' }} />
            <Stack.Screen name="edit-profile" options={{ headerShown: false, animation: 'slide_from_right' }} />
            <Stack.Screen name="friends" options={{ headerShown: false, animation: 'slide_from_right' }} />
            <Stack.Screen name="friend-search" options={{ headerShown: false, animation: 'slide_from_right' }} />
            <Stack.Screen name="invite/[handle]" options={{ headerShown: false, animation: 'slide_from_right' }} />
            <Stack.Screen name="guest-pass/[token]" options={{ headerShown: false, animation: 'slide_from_right' }} />
            <Stack.Screen name="night/[date]" options={{ headerShown: false, animation: 'slide_from_right' }} />
            <Stack.Screen name="recap/[token]" options={{ headerShown: false, animation: 'slide_from_right' }} />
            <Stack.Screen name="perk/[id]" options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="admin" options={{ headerShown: false }} />
          </Stack>
          {/* Draw nothing themselves; they need the providers above. The scan moment covers every screen. */}
          <PushRegistrar />
          <LocalDataUpload />
          <ScanMomentHost />
          <StatusBar style="light" />
        </ThemeProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
