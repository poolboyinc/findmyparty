import { StyleSheet, View, Text, TouchableOpacity, Image, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AntDesign } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ELLIPSE_WIDTH = 686;
const ELLIPSE_HEIGHT = 645;

export default function OnboardingPage() {
  const handleGoogleSignIn = () => {
    // TODO: implement Google Sign-In
  };

  const handleAppleSignIn = () => {
    // TODO: implement Apple Sign-In
  };

  const handleSignUp = () => {
    // TODO: navigate to sign-up screen
  };

  const handleLogIn = () => {
    router.push('/login');
  };

  return (
    <View style={styles.root}>
      {/* Background gradient */}
      <LinearGradient
        colors={['#000000', '#000000', '#2B0050', '#7D08FA']}
        locations={[0, 0.13, 0.52, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Purple ellipse blob */}
      <View style={[styles.ellipse, { left: (SCREEN_WIDTH - ELLIPSE_WIDTH) / 2 }]} />

      {/* Warm bottom glow to match Figma */}
      <LinearGradient
        colors={['transparent', 'rgba(180, 40, 20, 0.18)']}
        locations={[0.6, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

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
          >
            <AntDesign name="google" size={22} color="#DB4437" style={styles.socialIcon} />
            <Text style={styles.socialButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          {/* Continue with Apple */}
          <TouchableOpacity
            style={styles.socialButton}
            onPress={handleAppleSignIn}
            activeOpacity={0.8}
          >
            <AntDesign name="apple1" size={24} color="#000000" style={styles.socialIcon} />
            <Text style={styles.socialButtonText}>Continue with Apple</Text>
          </TouchableOpacity>

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
    top: '31%',
    borderRadius: ELLIPSE_WIDTH / 2,
    backgroundColor: '#7D08FA',
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
  },
  logo: {
    width: 190,
    height: 190,
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
    height: 51,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 34,
    borderWidth: 1,
    borderColor: '#646464',
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
