import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';
import { TamaguiProvider } from 'tamagui';
import { PortalProvider } from '@tamagui/portal';

import { authService } from '@/services/authService';
import tamaguiConfig from '@/tamagui.config';

SplashScreen.preventAutoHideAsync();

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
    const publicRoutes = ['onboarding', 'login', 'register', 'admin'];
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

// ULTRAVIOLET-tuned React Navigation theme — matches Tamagui tokens so
// native stack transitions don't flash white.
const UltraVioletNavTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#05020A', // $void
    card:       '#0A0612', // $surfaceBase
    text:       '#F5EBFF',
    border:     'rgba(255,255,255,0.10)',
    primary:    '#B026FF',
    notification: '#FF2E93',
  },
};

export default function RootLayout() {
  useProtectedRoute();

  const [fontsLoaded] = useFonts({
    Coolvetica: require('@/assets/fonts/coolvetica.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
      <PortalProvider shouldAddRootHost>
        <ThemeProvider value={UltraVioletNavTheme}>
          <Stack
            initialRouteName="splash"
            screenOptions={{
              contentStyle: { backgroundColor: '#05020A' },
            }}
          >
            <Stack.Screen name="splash" options={{ headerShown: false, animation: 'none' }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
            <Stack.Screen name="login" options={{ headerShown: false, animation: 'slide_from_right' }} />
            <Stack.Screen name="register" options={{ headerShown: false, animation: 'slide_from_right' }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false, gestureEnabled: false, animation: 'none' }} />
            <Stack.Screen name="party/[id]" options={{ headerShown: false, animation: 'slide_from_right' }} />
            <Stack.Screen name="my-bookings" options={{ headerShown: false, animation: 'slide_from_right' }} />
            <Stack.Screen name="admin" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
          <StatusBar style="light" />
        </ThemeProvider>
      </PortalProvider>
    </TamaguiProvider>
  );
}
