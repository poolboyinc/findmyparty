import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import { useFonts } from 'expo-font';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiConstants } from '@/constants/api';
import { ms, s, vs } from '@/constants/responsive';
import { colors, layout, radii, spacing, typography, weights } from '@/theme';
import { authService } from '../services/authService';

const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const GOOGLE_REVERSED_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_REVERSED_CLIENT_ID ?? '';

WebBrowser.maybeCompleteAuthSession();

export default function WelcomeScreen() {
  const [loading, setLoading] = useState<'google' | 'apple' | null>(null);
  const [backendDown, setBackendDown] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${ApiConstants.GatewayBaseUrl}/health`, {
          signal: controller.signal,
        });
        clearTimeout(id);
        if (!cancelled) setBackendDown(!res.ok);
      } catch {
        if (!cancelled) setBackendDown(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const [fontsLoaded] = useFonts({
    Coolvetica: require('../assets/fonts/coolvetica.ttf'),
  });

  const { height: H } = useWindowDimensions();
  const logoSize = Math.min(H * 0.28, 254);

  const redirectUri = AuthSession.makeRedirectUri({ scheme: GOOGLE_REVERSED_CLIENT_ID });

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    redirectUri,
  });

  useEffect(() => {
    if (!response) return;
    if (response.type === 'success' && request?.codeVerifier) {
      exchangeGoogleCode(response.params.code, request.codeVerifier);
    } else if (response.type !== 'success') {
      setLoading(null);
    }
  }, [response]);

  const exchangeGoogleCode = async (code: string, codeVerifier: string) => {
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_IOS_CLIENT_ID,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: codeVerifier,
        }).toString(),
      });

      const tokens = await tokenRes.json();
      if (!tokens.id_token) { setLoading(null); return; }

      const success = await authService.externalSignIn('google', tokens.id_token);
      if (success) router.replace('/(tabs)');
      else Alert.alert('Sign-in failed', 'Could not sign in with Google. Please try again.');
    } catch {
      Alert.alert('Connection error', 'Could not complete Google sign-in. Check your internet connection.');
    } finally {
      setLoading(null);
    }
  };

  const handleGoogleSignIn = () => {
    Haptics.selectionAsync();
    setLoading('google');
    promptAsync();
  };

  const handleAppleSignIn = async () => {
    Haptics.selectionAsync();
    setLoading('apple');
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const { identityToken, fullName } = credential;
      if (!identityToken) return;

      const name = [fullName?.givenName, fullName?.familyName]
        .filter(Boolean)
        .join(' ') || undefined;

      const success = await authService.externalSignIn('apple', identityToken, name);
      if (success) router.replace('/(tabs)');
      else Alert.alert('Sign-in failed', 'Could not sign in with Apple. Please try again.');
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Sign-in error', 'Something went wrong with Apple sign-in. Please try again.');
      }
    } finally {
      setLoading(null);
    }
  };

  const goRegister = () => {
    Haptics.selectionAsync();
    router.push('/register');
  };

  const goLogin = () => {
    Haptics.selectionAsync();
    router.push('/login');
  };

  const inputDisabled = backendDown || loading !== null;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Brand */}
        <View style={styles.logoSection}>
          <Image
            source={require('@/assets/images/fmp_logo.png')}
            style={{ width: logoSize, height: logoSize }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
            accessible={false}
          />
          <Text
            accessibilityRole="header"
            style={[
              styles.appName,
              fontsLoaded ? { fontFamily: 'Coolvetica' } : null,
            ]}
          >
            FindMyParty
          </Text>
        </View>

        {/* Auth group */}
        <View style={styles.bottomGroup}>
          {backendDown && (
            <View style={styles.connectionBanner} accessibilityRole="alert">
              <Ionicons name="cloud-offline-outline" size={ms(16)} color={colors.label} />
              <Text style={styles.connectionBannerText}>
                Unable to connect to server. Please check your connection.
              </Text>
            </View>
          )}

          <Pressable
            onPress={handleGoogleSignIn}
            disabled={inputDisabled}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            accessibilityState={{ busy: loading === 'google', disabled: inputDisabled }}
            style={({ pressed }) => [
              styles.socialButton,
              pressed && !inputDisabled && styles.pressed,
              inputDisabled && styles.disabled,
            ]}
          >
            {loading === 'google' ? (
              <ActivityIndicator color={colors.label} />
            ) : (
              <View style={styles.socialButtonContent}>
                <Image
                  source={require('../assets/images/google_logo.png')}
                  style={styles.socialIcon}
                  resizeMode="contain"
                />
                <Text style={styles.socialButtonText}>Continue with Google</Text>
              </View>
            )}
          </Pressable>

          <Pressable
            onPress={handleAppleSignIn}
            disabled={inputDisabled}
            accessibilityRole="button"
            accessibilityLabel="Continue with Apple"
            accessibilityState={{ busy: loading === 'apple', disabled: inputDisabled }}
            style={({ pressed }) => [
              styles.socialButton,
              pressed && !inputDisabled && styles.pressed,
              inputDisabled && styles.disabled,
            ]}
          >
            {loading === 'apple' ? (
              <ActivityIndicator color={colors.label} />
            ) : (
              <View style={styles.socialButtonContent}>
                <Ionicons name="logo-apple" size={ms(28)} color={colors.label} style={styles.appleIcon} />
                <Text style={styles.socialButtonText}>Continue with Apple</Text>
              </View>
            )}
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Or</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            onPress={goRegister}
            disabled={inputDisabled}
            accessibilityRole="button"
            accessibilityLabel="Sign up with email"
            accessibilityState={{ disabled: inputDisabled }}
            style={({ pressed }) => [
              styles.signUpWrapper,
              pressed && !inputDisabled && styles.pressed,
              inputDisabled && styles.disabled,
            ]}
          >
            <LinearGradient
              colors={colors.brand.gradient.colors}
              locations={colors.brand.gradient.locations}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.signUpGradient}
            >
              <Text style={styles.signUpText}>Sign Up</Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            onPress={goLogin}
            disabled={inputDisabled}
            hitSlop={layout.hitSlop}
            accessibilityRole="link"
            accessibilityLabel="Log in to existing account"
            style={({ pressed }) => [
              styles.loginPress,
              pressed && !inputDisabled && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.loginText}>
              Have an account already?{' '}
              <Text style={styles.loginTextHighlight}>Log in</Text>
            </Text>
          </Pressable>
        </View>

        {/* Legal — pinned to the bottom (mirrors Figma frame y=792 of 874) */}
        <Text style={styles.legal}>
          {'By continuing you automatically accept our '}
          <Text style={styles.legalUnderline}>Terms & Conditions</Text>
          {', '}
          <Text style={styles.legalUnderline}>Privacy Policy</Text>
          {' and '}
          <Text style={styles.legalUnderline}>Cookies Policy</Text>
        </Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: vs(8),
    paddingBottom: vs(24),
    alignItems: 'center',
    // Top-aligned flow: logo + auth block sit together near the top,
    // legal text is pushed to the bottom via marginTop:'auto'.
  },
  logoSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: vs(24),
  },
  appName: {
    color: colors.label,
    fontSize: ms(44),
    fontWeight: weights.heavy,
    letterSpacing: 0.5,
    textAlign: 'center',
    marginTop: vs(-24),
  },
  bottomGroup: {
    width: '100%',
    alignItems: 'center',
    gap: vs(12),
    marginTop: vs(32),
  },
  connectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,69,58,0.85)',
    borderRadius: radii.md,
    paddingVertical: vs(8),
    paddingHorizontal: spacing.base,
    marginBottom: vs(4),
    width: '100%',
  },
  connectionBannerText: {
    ...typography.footnote,
    color: colors.label,
    fontWeight: weights.medium,
    flexShrink: 1,
  },
  socialButton: {
    width: '100%',
    height: vs(48),
    minHeight: layout.minTouchTarget,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  socialIcon: {
    width: s(28),
    height: s(28),
  },
  appleIcon: {
    marginTop: -2,
  },
  socialButtonText: {
    color: colors.label,
    fontSize: ms(17),
    fontWeight: weights.semibold,
    letterSpacing: -0.4,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: vs(2),
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dividerText: {
    color: colors.label,
    fontSize: ms(12),
    fontWeight: weights.thin,
    marginHorizontal: spacing.md,
  },
  signUpWrapper: {
    width: '100%',
    height: vs(48),
    minHeight: layout.minTouchTarget,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  signUpGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signUpText: {
    color: colors.label,
    fontSize: ms(17),
    fontWeight: weights.bold,
    letterSpacing: -0.4,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.4,
  },
  loginPress: {
    paddingVertical: vs(6),
  },
  loginText: {
    ...typography.body,
    color: colors.label,
    textAlign: 'center',
  },
  loginTextHighlight: {
    color: colors.tint,
    fontWeight: weights.bold,
  },
  legal: {
    ...typography.caption1,
    color: colors.gray,
    textAlign: 'center',
    marginTop: 'auto',
    paddingHorizontal: spacing.sm,
    paddingTop: vs(16),
  },
  legalUnderline: {
    textDecorationLine: 'underline',
  },
});
