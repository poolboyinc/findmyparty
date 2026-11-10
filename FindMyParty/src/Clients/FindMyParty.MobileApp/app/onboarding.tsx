import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProviderButton } from '@/components/account/provider-button';
import { useGoogleIdToken } from '@/components/account/use-google-sign-in';
import { springs, useReducedMotion } from '@/components/afterglow/motion';
import { Display } from '@/components/afterglow/text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { CookiesUrl, PrivacyUrl, TermsUrl } from '@/constants/legal';
import { enterApp } from '@/hooks/useAuth';
import { useVenues } from '@/hooks/queries';
import { externalSignInDetailed } from '@/services/authActions';
import { externalErrorText } from '@/services/authErrorText';
import { colors, layout, spacing, typography } from '@/theme';

type Provider = 'apple' | 'google';

/** Apple's sign-in sheet rejects with this code when the user closes it. */
function isCancelled(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'ERR_REQUEST_CANCELED';
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

  const litCount = venues.isSuccess ? venues.data.filter((venue) => venue.crowdSource === 'live').length : 0;
  const litLine = `${litCount} ${litCount === 1 ? 'venue' : 'venues'} lit in Podgorica tonight`;

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
      enterApp();
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

  // The image has clear space around the mark; the name tucks up into the space below it.
  const logoSize = Math.min(height * 0.26, 220);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.base, paddingBottom: insets.bottom + spacing.base },
      ]}
      alwaysBounceVertical={false}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.brandArea}>
        <Animated.View style={[styles.brand, brandStyle]}>
          <Image
            source={require('@/assets/images/fmp_logo.png')}
            style={{ width: logoSize, height: logoSize }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
            accessible={false}
          />
          <Display size="lg" accessibilityRole="header" style={{ marginTop: -logoSize * 0.12 }}>
            FindMyParty
          </Display>
          <Text style={styles.tagline}>Find where the night is</Text>
        </Animated.View>
      </View>

      {/* A bonus line. Its room is kept so the buttons do not move when it arrives. */}
      <View style={styles.litSlot}>
        {litCount > 0 ? (
          <View style={styles.lit} accessible accessibilityRole="text" accessibilityLabel={litLine}>
            <View style={styles.litDot} />
            <Text style={styles.litText}>{litLine}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        {error ? (
          <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        {appleAvailable ? (
          <ProviderButton
            label="Continue with Apple"
            tone="light"
            icon={<Ionicons name="logo-apple" size={20} color={colors.ink} />}
            onPress={handleApple}
            loading={busy === 'apple'}
            disabled={busy !== null}
          />
        ) : null}
        <ProviderButton
          label="Continue with Google"
          tone="surface"
          icon={<Image source={require('@/assets/images/google_logo.png')} style={styles.googleLogo} resizeMode="contain" />}
          onPress={handleGoogle}
          loading={busy === 'google'}
          disabled={busy !== null}
        />
        <PrimaryButton label="Sign up with email" onPress={() => router.push('/register')} />

        <View style={styles.links}>
          <Pressable
            onPress={() => router.push('/login')}
            hitSlop={layout.hitSlop}
            accessibilityRole="link"
            accessibilityLabel="Have an account? Log in"
          >
            <Text style={styles.linkText}>
              Have an account? <Text style={styles.link}>Log in</Text>
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/admin/login')}
            hitSlop={layout.hitSlop}
            accessibilityRole="link"
            accessibilityLabel="Host sign in"
          >
            <Text style={styles.linkText}>Host sign in</Text>
          </Pressable>
        </View>
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
    </ScrollView>
  );
}

const LIT_DOT = 8;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: layout.screenMargin,
  },
  brandArea: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  brand: {
    alignItems: 'center',
  },
  tagline: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  litSlot: {
    minHeight: typography.subheadline.lineHeight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.base,
  },
  lit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  litDot: {
    width: LIT_DOT,
    height: LIT_DOT,
    borderRadius: LIT_DOT / 2,
    backgroundColor: colors.crowd,
  },
  litText: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.crowd,
    flexShrink: 1,
  },
  actions: {
    gap: spacing.md,
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
    columnGap: spacing.xxl,
    rowGap: spacing.md,
    paddingVertical: spacing.sm,
  },
  linkText: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
  link: {
    fontWeight: '600',
    color: colors.tint,
  },
  legal: {
    ...typography.caption1,
    color: colors.labelSecondary,
    textAlign: 'center',
    marginTop: spacing.base,
    paddingHorizontal: spacing.sm,
  },
  legalLink: {
    fontWeight: '600',
    color: colors.label,
  },
});
