import { StyleSheet, View, Text, TouchableOpacity, Image, Dimensions, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { authService } from '../services/authService';

// ─────────────────────────────────────────────────────────────────────────────
// Fill these in after creating your Google Cloud Console project:
//   1. Create a project at https://console.cloud.google.com
//   2. APIs & Services → Credentials → Create Credentials → OAuth client ID
//   3. Create an "iOS" type client with bundle ID: com.fmpglobalinc.findmyparty
//   4. Paste both values below, and also update "Google:ClientId" in
//      the Identity API's appsettings.json (or environment variable).
// ─────────────────────────────────────────────────────────────────────────────
const GOOGLE_IOS_CLIENT_ID = '614494491110-0soalbm7utg2he0a3psop3ju0oab6b7v.apps.googleusercontent.com';
const GOOGLE_REVERSED_CLIENT_ID = 'com.googleusercontent.apps.614494491110-0soalbm7utg2he0a3psop3ju0oab6b7v';

WebBrowser.maybeCompleteAuthSession();

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ELLIPSE_WIDTH = 686;
const ELLIPSE_HEIGHT = 645;
const LOGO_SECTION_HEIGHT = 230;

export default function OnboardingPage() {
  const [loading, setLoading] = useState<'google' | 'apple' | null>(null);

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
      {/* Background gradient — dark purple top → orange bottom */}
      <LinearGradient
        colors={['#000000', '#0D001A', '#5B0090', '#C84B00', '#FF8C48']}
        locations={[0, 0.12, 0.48, 0.82, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Purple ellipse blob — semi-transparent so gradient shows through */}
      <View style={[styles.ellipse, { left: (SCREEN_WIDTH - ELLIPSE_WIDTH) / 2 }]} />

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
          <Text style={styles.appName}>FindMyParty</Text>
        </View>

        {/* Buttons section */}
        <View style={styles.buttonsSection}>
          {/* Continue with Google */}
          <TouchableOpacity
            style={styles.socialButton}
            onPress={handleGoogleSignIn}
            activeOpacity={0.8}
            disabled={loading !== null}
          >
            {loading === 'google'
              ? <ActivityIndicator size="small" color="#DB4437" style={styles.socialIcon} />
              : <Image source={require('@/assets/images/google-logo.png')} style={styles.googleIcon} />}
            <Text style={styles.socialButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          {/* Continue with Apple — uses the official native button required by Apple */}
          {loading === 'apple' ? (
            <View style={[styles.socialButton, styles.socialButtonLoading]}>
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
        <TouchableOpacity onPress={handleLogIn} activeOpacity={0.7}>
          <Text style={styles.loginText}>
            Have an account already?{'  '}
            <Text style={styles.loginTextHighlight}>Log in</Text>
          </Text>
        </TouchableOpacity>

        {/* Legal */}
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
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  ellipse: {
    position: 'absolute',
    width: ELLIPSE_WIDTH,
    height: ELLIPSE_HEIGHT,
    top: '38%',
    borderRadius: ELLIPSE_WIDTH / 2,
    backgroundColor: 'rgba(125, 8, 250, 0.55)',
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 36,
  },
  logoSection: {
    alignItems: 'center',
    height: LOGO_SECTION_HEIGHT,
    justifyContent: 'center',
  },
  logo: {
    width: 160,
    height: 160,
  },
  // Hidden — kept for future use if a separate wordmark asset is added
  wordmark: {
    display: 'none',
    width: 0,
    height: 0,
  },
  appName: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginTop: 8,
  },
  buttonsSection: {
    width: '100%',
    gap: 12,
  },
  socialButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 48,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 34,
    borderWidth: 1,
    borderColor: '#646464',
  },
  socialButtonLoading: {
    justifyContent: 'center',
  },
  appleButton: {
    width: '100%',
    height: 56,
  },
  googleIcon: {
    width: 24,
    height: 24,
    marginRight: 13,
    resizeMode: 'contain',
  },
  socialIcon: {
    width: 32,
    textAlign: 'center',
    marginRight: 13,
  },
  socialButtonText: {
    color: '#000000',
    fontSize: 18,
    fontWeight: '700',
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
    height: 51,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#646464',
  },
  signUpText: {
    color: '#FFFFFF',
    fontSize: 20,
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
});
