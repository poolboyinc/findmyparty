import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { authService } from '@/services/authService';

export const unstable_settings = {
  anchor: '(tabs)',
};

/**
 * Redirects unauthenticated users away from protected routes.
 * Runs whenever the active segment changes.
 */
function useProtectedRoute() {
  const segments = useSegments();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Don't guard while splash is still showing
    const root = segments[0];
    if (root === 'splash' || root === undefined) return;

    // Auth and onboarding screens are always accessible
    const publicRoutes = ['onboarding', 'login', 'register'];
    if (publicRoutes.includes(root)) {
      setChecked(true);
      return;
    }

    // For all other routes, verify authentication
    authService.isAuthenticated().then((authenticated) => {
      if (!authenticated) {
        router.replace('/onboarding');
      }
      setChecked(true);
    });
  }, [segments[0]]);

  return checked;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  useProtectedRoute();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack initialRouteName="splash">
        <Stack.Screen name="splash" options={{ headerShown: false, animation: 'none' }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="login" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="register" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="party/[id]" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}
