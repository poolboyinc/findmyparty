import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { outTonightLine } from '@/components/account/out-tonight';
import { FlatButton } from '@/components/account/provider-button';
import { useGoogleIdToken } from '@/components/account/use-google-sign-in';
import { springs, useReducedMotion } from '@/components/afterglow/motion';
import { Display } from '@/components/afterglow/text';
import { CityBackdrop } from '@/components/city/backdrop';
import { CITY } from '@/components/city/constants';
import { Scrim, type ScrimStop } from '@/components/first-run/scrim';
import { CookiesUrl, PrivacyUrl, TermsUrl } from '@/constants/legal';
import { enterApp } from '@/hooks/useAuth';
import { useVenues } from '@/hooks/queries';
import { externalSignInDetailed } from '@/services/authActions';
import { externalErrorText } from '@/services/authErrorText';
import { colors, display, layout, radii, spacing, typography } from '@/theme';

type Provider = 'apple' | 'google';

/** S-01: dark behind the logo, clear in the middle where the beams stand, dark again behind the buttons. */
const SCRIM: readonly ScrimStop[] = [
  [0, 0.86],
  [0.34, 0.8],
  [0.5, 0.1],
  [0.62, 0.2],
  [0.78, 0.96],
  [1, 0.96],
];

// The logo image has empty space around the mark. These are the mark's edges in the 873 px square,
// so the mark can be sized and placed by itself.
const MARK_TOP = 95 / 873;
const MARK_BOTTOM = 718 / 873;
/** The mock's 128 pt mark on a 286 pt wide screen, scaled to a phone. */
const MARK_HEIGHT = 173;

/** Apple's sign-in sheet rejects with this code when the user closes it. */
function isCancelled(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'ERR_REQUEST_CANCELED';
}

/** The rose dot before the live line; it breathes like the mock's, and holds still with Reduce Motion on. */
function LiveDot() {
  const reduceMotion = useReducedMotion();
  const glow = useSharedValue(1);
  useEffect(() => {
    glow.value = reduceMotion
      ? 1
      : withRepeat(withSequence(withTiming(0.35, { duration: 800 }), withTiming(1, { duration: 800 })), -1);
  }, [glow, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: glow.value }));
  return <Animated.View style={[styles.liveDot, style]} />;
}

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const venues = useVenues();
  const getGoogleIdToken = useGoogleIdToken();

  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Assume it is there on an iPhone so the button does not pop in; take it away if the phone says no.
  const [appleAvailable, setAppleAvailable] = useState(Platform.OS === 'ios');

  useEffect(() => {
    let cancelled = false;
    AppleAuthentication.isAvailableAsync()
      .catch(() => false)
      .then((available) => {
        if (!cancelled) setAppleAvailable(available);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The one entrance on this screen: the logo and name settle in once.
  const arrival = useSharedValue(0);
  useEffect(() => {
    arrival.value = reduceMotion ? withTiming(1, { duration: 200 }) : withSpring(1, springs.arrive);
  }, [arrival, reduceMotion]);
  const brandStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, arrival.value),
    transform: reduceMotion ? [] : [{ translateY: (1 - arrival.value) * 28 }, { scale: 0.9 + 0.1 * arrival.value }],
  }));

  const liveLine = venues.isSuccess ? outTonightLine(venues.data, CITY.name) : null;

  /** Runs one provider's sign-in. `getIdentity` resolves with null when the user backed out. */
  const signIn = async (
    provider: Provider,
    providerName: 'Apple' | 'Google',
    getIdentity: () => Promise<{ idToken: string; name?: string } | null>,
  ) => {
    if (busy) return;
    setBusy(provider);
    setError(null);
    try {
      const identity = await getIdentity();
      if (!identity) return;
      await externalSignInDetailed(provider, identity.idToken, identity.name);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // The server does not say whether this made a new account; first run shows when this phone has not had it.
      await enterApp();
    } catch (e) {
      if (isCancelled(e)) return;
      setError(externalErrorText(providerName, e));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(null);
    }
  };

  const handleApple = () =>
    signIn('apple', 'Apple', async () => {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('Apple returned no identity token.');
      const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ') || undefined;
      return { idToken: credential.identityToken, name };
    });

  const handleGoogle = () =>
    signIn('google', 'Google', async () => {
      const idToken = await getGoogleIdToken();
      return idToken ? { idToken } : null;
    });

  // Smaller phones get a smaller mark so the city still shows between the name and the buttons.
  const markHeight = Math.min(MARK_HEIGHT, height * 0.2);
  const logoSize = markHeight / (MARK_BOTTOM - MARK_TOP);

  return (
    <View style={styles.root}>
      <CityBackdrop style={StyleSheet.absoluteFill} />
      <Scrim stops={SCRIM} />

      <ScrollView
        style={styles.fill}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xs },
        ]}
        alwaysBounceVertical={false}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.brand, brandStyle]}>
          <Image
            source={require('@/assets/images/fmp_logo.png')}
            style={{
              width: logoSize,
              height: logoSize,
              marginTop: -logoSize * MARK_TOP,
              marginBottom: -logoSize * (1 - MARK_BOTTOM),
            }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
            accessible={false}
          />
          <Display accessibilityRole="header" style={styles.name}>
            FindMyParty
          </Display>
          <Text style={styles.tagline}>Find where the night is</Text>
        </Animated.View>

        <View style={styles.bottom}>
          {/* The live line keeps its room, so the buttons do not move when it arrives. */}
          <View style={styles.liveSlot}>
            {liveLine ? (
              <View style={styles.live} accessible accessibilityRole="text" accessibilityLabel={liveLine}>
                <LiveDot />
                <Text style={styles.liveText}>{liveLine}</Text>
              </View>
            ) : null}
          </View>

          {error ? (
            <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}

          {appleAvailable ? (
            <FlatButton
              label="Continue with Apple"
              tone="light"
              icon={<Ionicons name="logo-apple" size={20} color={colors.ink} />}
              onPress={handleApple}
              loading={busy === 'apple'}
              disabled={busy !== null}
            />
          ) : null}
          <FlatButton
            label="Continue with Google"
            tone="surface"
            icon={<Image source={require('@/assets/images/google_logo.png')} style={styles.googleLogo} resizeMode="contain" />}
            onPress={handleGoogle}
            loading={busy === 'google'}
            disabled={busy !== null}
          />
          <FlatButton label="Sign up with email" tone="action" onPress={() => router.push('/register')} disabled={busy !== null} />

          <View style={styles.links}>
            <Pressable
              onPress={() => router.push('/login')}
              hitSlop={layout.hitSlop}
              accessibilityRole="link"
              accessibilityLabel="Have an account? Log in"
            >
              <Text style={styles.linkText}>
                Have an account? <Text style={styles.logIn}>Log in</Text>
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/admin/login')}
              hitSlop={layout.hitSlop}
              accessibilityRole="link"
              accessibilityLabel="Host sign in"
            >
              <Text style={styles.hostText}>Host sign in</Text>
            </Pressable>
          </View>

          <Text style={styles.legal}>
            {'By continuing you accept our '}
            <Text style={styles.legalLink} accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(TermsUrl)}>
              Terms and conditions
            </Text>
            {', '}
            <Text style={styles.legalLink} accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(PrivacyUrl)}>
              Privacy policy
            </Text>
            {' and '}
            <Text style={styles.legalLink} accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(CookiesUrl)}>
              Cookies policy
            </Text>
            .
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const LIVE_DOT = 8;
/** The mock's 31 pt name on a 286 pt wide screen, scaled to a phone (between `display.lg` and `display.xl`). */
const NAME_SIZE = 42;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  fill: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  brand: {
    alignItems: 'center',
    paddingHorizontal: layout.screenMargin,
  },
  name: {
    fontFamily: display.lg.fontFamily,
    fontSize: NAME_SIZE,
    lineHeight: NAME_SIZE + 2,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  tagline: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.labelTertiary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  bottom: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  liveSlot: {
    minHeight: typography.footnote.lineHeight + spacing.base,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.sheet,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
  },
  liveDot: {
    width: LIVE_DOT,
    height: LIVE_DOT,
    borderRadius: LIVE_DOT / 2,
    backgroundColor: colors.crowd,
  },
  liveText: {
    ...typography.footnote,
    fontWeight: '700',
    color: colors.crowd,
    flexShrink: 1,
  },
  error: {
    ...typography.subheadline,
    color: colors.danger,
    textAlign: 'center',
  },
  googleLogo: {
    width: 20,
    height: 20,
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    columnGap: spacing.xl,
    rowGap: spacing.sm,
    paddingTop: spacing.xs,
  },
  linkText: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
  logIn: {
    fontWeight: '700',
    color: colors.crowd,
  },
  hostText: {
    ...typography.subheadline,
    color: colors.labelTertiary,
  },
  legal: {
    ...typography.caption2,
    color: colors.labelTertiary,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  legalLink: {
    fontWeight: '600',
    color: colors.labelSecondary,
  },
});
