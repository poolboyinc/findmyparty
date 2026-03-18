import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import { BlurView } from 'expo-blur';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authService } from '../services/authService';

// ─────────────────────────────────────────────────────────────────────────────
// Fill these in after creating your Google Cloud Console project:
//   1. Create a project at https://console.cloud.google.com
//   2. APIs & Services → Credentials → Create Credentials → OAuth client ID
//   3. Create an "iOS" type client with bundle ID: com.fmpglobalinc.findmyparty
//   4. Paste both values below, and also update "Google:ClientId" in
//      the Identity API's appsettings.json (or environment variable).
// ─────────────────────────────────────────────────────────────────────────────
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const GOOGLE_REVERSED_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_REVERSED_CLIENT_ID ?? '';

WebBrowser.maybeCompleteAuthSession();

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ELLIPSE_WIDTH = SCREEN_WIDTH * 2.2;
const ELLIPSE_HEIGHT = SCREEN_HEIGHT * 1.2;
const LOGO_SECTION_HEIGHT = 200;

export default function OnboardingPage() {
  const [loading, setLoading] = useState<'google' | 'apple' | null>(null);

  const [fontsLoaded] = useFonts({
    Coolvetica: require('../assets/fonts/coolvetica.ttf'),
  });

  const redirectUri = AuthSession.makeRedirectUri({ scheme: GOOGLE_REVERSED_CLIENT_ID });

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    redirectUri,
  });

  // Called after Google OAuth redirect returns with an auth code
  useEffect(() => {
    if (response?.type === 'success' && request?.codeVerifier) {
      exchangeGoogleCode(response.params.code, request.codeVerifier);
    } else if (response?.type === 'error' || response?.type === 'dismiss') {
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
    } catch {
      // silent — user stays on onboarding
    } finally {
      setLoading(null);
    }
  };

  const handleGoogleSignIn = () => {
    setLoading('google');
    promptAsync();
  };

  const handleAppleSignIn = async () => {
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

      // Apple only provides fullName on the very first sign-in
      const name = [fullName?.givenName, fullName?.familyName]
        .filter(Boolean)
        .join(' ') || undefined;

      const success = await authService.externalSignIn('apple', identityToken, name);
      if (success) router.replace('/(tabs)');
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') console.error('Apple sign-in:', e);
    } finally {
      setLoading(null);
    }
  };

  const handleSignUp = () => {
    router.push('/register');
  };

  const handleLogIn = () => {
    router.push('/login');
  };

  return (
    <View style={styles.root}>
      {/* Pure black background */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000000' }]} />

      {/* Sphere — large gradient orb sitting in the lower ~65% of the screen.
          Gradient goes purple (top of orb) → magenta → coral → orange (bottom of orb) */}
      <View style={[styles.ellipse, { left: (SCREEN_WIDTH - ELLIPSE_WIDTH) / 2 }]}>
        <LinearGradient
          colors={['#8B0DFF', '#C2007A', '#FF5230', '#FF8C48']}
          locations={[0, 0.4, 0.75, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <SafeAreaView style={styles.safeArea}>
        {/* Logo section */}
        <View style={styles.logoSection}>
          <Image
            source={require('@/assets/images/fmp_logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Image
            source={require('@/assets/images/fmp_logo.png')}
            style={styles.wordmark}
            resizeMode="contain"
          />
          <Text style={[styles.appName, fontsLoaded ? { fontFamily: 'Coolvetica' } : {}]}>FindMyParty</Text>
        </View>

        {/* Bottom group — all content below the logo */}
        <View style={styles.bottomGroup}>
          {/* Buttons section */}
          <View style={styles.buttonsSection}>
            {/* Continue with Google */}
            {loading === 'google' ? (
              <View style={styles.socialButtonLoading}>
                <ActivityIndicator size="small" color="#000000" />
              </View>
            ) : (
              <TouchableOpacity
                style={styles.googleButton}
                onPress={handleGoogleSignIn}
                disabled={loading !== null}
                activeOpacity={0.85}
              >
                <Image
                  source={require('../assets/images/google_logo.png')}
                  style={styles.googleLogo}
                  resizeMode="contain"
                />
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </TouchableOpacity>
            )}

            {/* Continue with Apple — uses the official native button required by Apple */}
            {loading === 'apple' ? (
              <View style={styles.socialButtonLoading}>
                <ActivityIndicator size="small" color="#000000" />
              </View>
            ) : (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={48}
                style={styles.appleButton}
                onPress={handleAppleSignIn}
              />
            )}

            {/* Or divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Sign Up */}
            <TouchableOpacity
              style={styles.signUpButton}
              onPress={handleSignUp}
              activeOpacity={0.85}
            >
              <Text style={styles.signUpText}>Sign Up</Text>
            </TouchableOpacity>
          </View>

          {/* Login link */}
          <TouchableOpacity onPress={handleLogIn} activeOpacity={0.7} style={{ marginTop: 28 }}>
            <Text style={styles.loginText}>
              Have an account already?{'  '}
              <Text style={styles.loginTextHighlight}>Log in</Text>
            </Text>
          </TouchableOpacity>

          {/* Admin portal entry */}
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => router.push('/admin')}
            style={[styles.adminBtnWrapper, { marginTop: 26 }]}
          >
            <BlurView intensity={20} tint="dark" style={styles.adminBtnBlur}>
              <LinearGradient
                colors={['#3D0080', '#7E0AFA', '#FF6E00']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.adminBtnGradient}
              >
                <Ionicons name="shield-checkmark-outline" size={17} color="rgba(255,255,255,0.85)" />
                <Text style={styles.adminBtnText}>Transfer to Admin Portal</Text>
              </LinearGradient>
            </BlurView>
          </TouchableOpacity>

          {/* Legal */}
          <Text style={[styles.legal, { marginTop: 20 }]}>
            {'By continuing you automatically accept our '}
            <Text style={styles.legalUnderline}>Terms & Conditions</Text>
            {', '}
            <Text style={styles.legalUnderline}>Privacy Policy</Text>
            {' and '}
            <Text style={styles.legalUnderline}>Cookies Policy</Text>
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  ellipse: {
    position: 'absolute',
    width: ELLIPSE_WIDTH,
    height: ELLIPSE_HEIGHT,
    top: '40%',
    borderRadius: ELLIPSE_WIDTH / 2,
    overflow: 'hidden',
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 24,
    paddingBottom: 40,
    paddingHorizontal: 36,
  },
  bottomGroup: {
    width: '100%',
    alignItems: 'center',
  },
  logoSection: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    marginTop: 'auto',
    marginBottom: 160,
  },
  logo: {
    width: 240,
    height: 240,
  },
  // Hidden — kept for future use if a separate wordmark asset is added
  wordmark: {
    display: 'none',
    width: 0,
    height: 0,
  },
  appName: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: -30,
  },
  buttonsSection: {
    width: '100%',
    gap: 14,
  },
  googleButton: {
    width: '100%',
    height: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#646464',
    gap: 10,
  },
  googleLogo: {
    width: 20,
    height: 20,
  },
  googleButtonText: {
    color: '#3C4043',
    fontSize: 15,
    fontWeight: '600',
  },
  socialButtonLoading: {
    backgroundColor: '#FFFFFF',
    borderRadius: 48,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#646464',
  },
  appleButton: {
    width: '100%',
    height: 44,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dividerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '100',
    marginHorizontal: 12,
  },
  signUpButton: {
    backgroundColor: '#7E0AFA',
    borderRadius: 48,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signUpText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  loginText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
  loginTextHighlight: {
    color: '#7E0AFA',
    fontWeight: '700',
  },
  legal: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 17,
  },
  legalUnderline: {
    textDecorationLine: 'underline',
  },
  adminBtnWrapper: {
    width: '100%',
    height: 42,
    borderRadius: 48,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  adminBtnBlur: {
    flex: 1,
  },
  adminBtnGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  adminBtnText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
