import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { authService } from '@/services/authService';
import { needsFirstRun } from '@/services/taste';
import { colors } from '@/theme';

/** Long enough that the logo does not flash by. */
const MIN_VISIBLE_MS = 400;
/** The native launch screen shows the mark at this width; keep it the same so nothing jumps. */
const LOGO_SIZE = 200;

/**
 * Where a launch goes: signed out to the welcome; signed in to first run while this phone has not had it
 * and the account has no taste yet; otherwise the app.
 */
async function launchRoute(): Promise<'/onboarding' | '/first-run' | '/(tabs)'> {
  const signedIn = await authService.isAuthenticated().catch(() => false);
  if (!signedIn) return '/onboarding';
  return (await needsFirstRun()) ? '/first-run' : '/(tabs)';
}

/**
 * The first screen: decides where to go from the session, the first-run flag and the account's taste.
 * A signed-in user goes straight on, also with no connection (being offline is not being signed out;
 * the account is only asked when this phone has not had first run).
 */
export default function SplashPage() {
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    launchRoute().then((route) => {
      if (cancelled) return;
      const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - startedAt));
      timer = setTimeout(() => router.replace(route), remaining);
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <View style={styles.root}>
      <Image
        source={require('@/assets/images/fmp_logo.png')}
        style={styles.logo}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
        accessible={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
});
