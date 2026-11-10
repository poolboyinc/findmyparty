import { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { authService } from '@/services/authService';
import { colors } from '@/theme';

/** Long enough that the logo does not flash by. */
const MIN_VISIBLE_MS = 400;
/** The native launch screen shows the mark at this width; keep it the same so nothing jumps. */
const LOGO_SIZE = 200;

/**
 * The first screen: decides where to go from the session alone. A signed-in user goes straight
 * to the app, also with no connection (being offline is not being signed out).
 */
export default function SplashPage() {
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    authService
      .isAuthenticated()
      .catch(() => false)
      .then((signedIn) => {
        if (cancelled) return;
        const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - startedAt));
        timer = setTimeout(() => router.replace(signedIn ? '/(tabs)' : '/onboarding'), remaining);
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
