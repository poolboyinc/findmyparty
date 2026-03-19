import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import { BlurView } from 'expo-blur';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { s, vs, ms } from '@/constants/responsive';
import { authService } from '../services/authService';

const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const GOOGLE_REVERSED_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_REVERSED_CLIENT_ID ?? '';

WebBrowser.maybeCompleteAuthSession();

export default function OnboardingPage() {
  const [loading, setLoading] = useState<'google' | 'apple' | null>(null);

  const [fontsLoaded] = useFonts({
    Coolvetica: require('../assets/fonts/coolvetica.ttf'),
  });

  // ─── Responsive layout ────────────────────────────────────────────────────────
  // All proportions are derived from the reference device (390×844 pt).
  // useWindowDimensions re-evaluates if the window ever changes (e.g. split-view on iPad).
  const { width: W, height: H } = useWindowDimensions();

  const rs = useMemo(() => {
    const ellipseW = W * 2.2;
    return {
      ellipseW,
      ellipseH:          H * 1.2,
      ellipseLeft:       (W - ellipseW) / 2,
      ellipseBorderRadius: ellipseW / 2,
      // Logo sits at the top — fixed proportion of screen height
      logoSize:          H * 0.284,
      logoMarginBottom:  H * 0.148,
      appNameMarginTop:  H * -0.036,
      // Safe-area padding
      paddingTop:        H * 0.028,
      paddingBottom:     H * 0.047,
      paddingHorizontal: W * 0.092,
      // Spacing between bottom elements
      loginMarginTop:    H * 0.033,
      adminMarginTop:    H * 0.031,
      legalMarginTop:    H * 0.024,
    };
  }, [W, H]);

  // ─── Auth ────────────────────────────────────────────────────────────────────
  const redirectUri = AuthSession.makeRedirectUri({ scheme: GOOGLE_REVERSED_CLIENT_ID });

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    redirectUri,
  });

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
      else Alert.alert('Sign-in failed', 'Could not sign in with Google. Please try again.');
    } catch {
      Alert.alert('Connection error', 'Could not complete Google sign-in. Check your internet connection.');
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

  return (
    <View style={styles.root}>
      {/* Pure black background */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000000' }]} />

      {/* Sphere — wide gradient orb in the lower portion of the screen */}
      <View
        style={[
          styles.ellipseBase,
          {
            width:        rs.ellipseW,
            height:       rs.ellipseH,
            left:         rs.ellipseLeft,
            borderRadius: rs.ellipseBorderRadius,
          },
        ]}
      >
        <LinearGradient
          colors={['#8B0DFF', '#C2007A', '#FF5230', '#FF8C48']}
          locations={[0, 0.4, 0.75, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <SafeAreaView
        style={[
          styles.safeArea,
          {
            paddingTop:        rs.paddingTop,
            paddingBottom:     rs.paddingBottom,
            paddingHorizontal: rs.paddingHorizontal,
          },
        ]}
      >
        {/* Logo section */}
        <View style={[styles.logoSection, { marginBottom: rs.logoMarginBottom }]}>
          <Image
            source={require('@/assets/images/fmp_logo.png')}
            style={{ width: rs.logoSize, height: rs.logoSize }}
            resizeMode="contain"
          />
          <Text
            style={[
              styles.appName,
              { marginTop: rs.appNameMarginTop },
              fontsLoaded ? { fontFamily: 'Coolvetica' } : {},
            ]}
          >
            FindMyParty
          </Text>
        </View>

        {/* Bottom group */}
        <View style={styles.bottomGroup}>
          {/* Buttons */}
          <View style={styles.buttonsSection}>
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

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity style={styles.signUpButton} onPress={() => router.push('/register')} activeOpacity={0.85}>
              <Text style={styles.signUpText}>Sign Up</Text>
            </TouchableOpacity>
          </View>

          {/* Login link */}
          <TouchableOpacity
            onPress={() => router.push('/login')}
            activeOpacity={0.7}
            style={{ marginTop: rs.loginMarginTop }}
          >
            <Text style={styles.loginText}>
              Have an account already?{'  '}
              <Text style={styles.loginTextHighlight}>Log in</Text>
            </Text>
          </TouchableOpacity>

          {/* Admin portal */}
          <TouchableOpacity
            activeOpacity={0.82}
            onPress={() => router.push('/admin')}
            style={[styles.adminBtnWrapper, { marginTop: rs.adminMarginTop }]}
          >
            <BlurView intensity={20} tint="dark" style={styles.adminBtnBlur}>
              <LinearGradient
                colors={['#3D0080', '#7E0AFA', '#FF6E00']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.adminBtnGradient}
              >
                <Ionicons name="shield-checkmark-outline" size={ms(17)} color="rgba(255,255,255,0.85)" />
                <Text style={styles.adminBtnText}>Transfer to Admin Portal</Text>
              </LinearGradient>
            </BlurView>
          </TouchableOpacity>

          {/* Legal */}
          <Text style={[styles.legal, { marginTop: rs.legalMarginTop }]}>
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
  // Dimension-dependent width/height/left/borderRadius are applied inline via `rs`
  ellipseBase: {
    position: 'absolute',
    top: '40%',
    overflow: 'hidden',
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    // padding values applied inline via `rs`
  },
  logoSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
    // marginBottom applied inline via `rs`
  },
  appName: {
    color: '#FFFFFF',
    fontSize: ms(30),
    fontWeight: '800',
    letterSpacing: 0.5,
    // marginTop applied inline via `rs`
  },
  bottomGroup: {
    width: '100%',
    alignItems: 'center',
  },
  buttonsSection: {
    width: '100%',
    gap: vs(14),
  },
  googleButton: {
    width: '100%',
    height: vs(44),
    backgroundColor: '#FFFFFF',
    borderRadius: s(48),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#646464',
    gap: s(10),
  },
  googleLogo: {
    width: s(20),
    height: vs(20),
  },
  googleButtonText: {
    color: '#3C4043',
    fontSize: ms(15),
    fontWeight: '600',
  },
  socialButtonLoading: {
    backgroundColor: '#FFFFFF',
    borderRadius: s(48),
    height: vs(44),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#646464',
  },
  appleButton: {
    width: '100%',
    height: vs(44),
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: vs(2),
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dividerText: {
    color: '#FFFFFF',
    fontSize: ms(12),
    fontWeight: '100',
    marginHorizontal: s(12),
  },
  signUpButton: {
    backgroundColor: '#7E0AFA',
    borderRadius: s(48),
    height: vs(44),
    alignItems: 'center',
    justifyContent: 'center',
  },
  signUpText: {
    color: '#FFFFFF',
    fontSize: ms(16),
    fontWeight: '700',
  },
  loginText: {
    color: '#FFFFFF',
    fontSize: ms(16),
    fontWeight: '400',
    textAlign: 'center',
  },
  loginTextHighlight: {
    color: '#7E0AFA',
    fontWeight: '700',
  },
  legal: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: ms(11),
    textAlign: 'center',
    lineHeight: vs(17),
  },
  legalUnderline: {
    textDecorationLine: 'underline',
  },
  adminBtnWrapper: {
    width: '100%',
    height: vs(42),
    borderRadius: s(48),
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
    gap: s(8),
  },
  adminBtnText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: ms(14),
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
