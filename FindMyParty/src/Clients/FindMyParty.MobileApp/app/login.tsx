import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useLogin } from '@/hooks/useAuth';
import { s, vs, ms } from '@/constants/responsive';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value: string) {
  return EMAIL_REGEX.test(value.trim());
}


export default function LoginPage() {
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const ellipseSize = W * 2.2;
  const { email, setEmail, password, setPassword, error, loading, login } = useLogin();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const identifierValid = email.trim().length >= 2;
  const looksLikeEmail = email.includes('@');
  const emailInvalid = emailTouched && looksLikeEmail && !isValidEmail(email);

  const formValid = identifierValid && (!looksLikeEmail || isValidEmail(email)) && password.length > 0;

  const handleSignIn = async () => {
    if (!formValid) return;
    const success = await login();
    if (success) router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Background gradient: purple → pink → orange */}
      <LinearGradient
        colors={['#7D08FA', '#B03070', '#C84B00', '#FF8C48']}
        locations={[0, 0.38, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Purple ellipse blob at bottom */}
      <View style={[styles.ellipseBottom, {
        width: ellipseSize,
        height: ellipseSize,
        borderRadius: ellipseSize / 2,
        left: (W - ellipseSize) / 2,
      }]} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={ms(26)} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Sign In</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Form */}
      <View style={styles.form}>
        {/* Email */}
        <View style={styles.fieldRow}>
          <Ionicons name="person-outline" size={ms(28)} color="#FFF" style={styles.fieldIcon} />
          <TextInput
            style={styles.fieldInput}
            placeholder="Email or Username"
            placeholderTextColor="rgba(255,255,255,0.75)"
            value={email}
            onChangeText={setEmail}
            onBlur={() => setEmailTouched(true)}
            keyboardType="default"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <View style={[styles.fieldLine, emailInvalid && styles.fieldLineError]} />
        {emailInvalid && (
          <Text style={styles.fieldError}>Please enter a valid email address</Text>
        )}

        {/* Password */}
        <View style={styles.fieldRow}>
          <Ionicons name="lock-closed-outline" size={ms(28)} color="#FFF" style={styles.fieldIcon} />
          <TextInput
            style={styles.fieldInput}
            placeholder="Password"
            placeholderTextColor="rgba(255,255,255,0.75)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!passwordVisible}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity onPress={() => setPasswordVisible(v => !v)} activeOpacity={0.7}>
            <Ionicons
              name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={ms(28)}
              color="#FFF"
            />
          </TouchableOpacity>
        </View>
        <View style={styles.fieldLine} />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Sign In button */}
        <TouchableOpacity
          style={[styles.button, formValid && styles.buttonActive]}
          onPress={handleSignIn}
          activeOpacity={0.85}
          disabled={loading || !formValid}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        {/* Sign up link */}
        <TouchableOpacity onPress={() => router.push('/register')} activeOpacity={0.7}>
          <Text style={styles.linkText}>
            Don't have an account?{'  '}
            <Text style={styles.linkHighlight}>Sign Up</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#7D08FA',
  },
  ellipseBottom: {
    position: 'absolute',
    bottom: '-160%',
    backgroundColor: '#7D08FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(20),
    paddingBottom: vs(16),
  },
  backBtn: {
    width: s(48),
    height: vs(48),
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#FFF',
    fontSize: ms(32),
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  form: {
    flex: 1,
    paddingHorizontal: s(28),
    paddingTop: '18%',
    gap: vs(28),
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(16),
  },
  fieldIcon: {
    width: s(32),
  },
  fieldInput: {
    flex: 1,
    color: '#FFF',
    fontSize: ms(22),
    fontWeight: '300',
    paddingVertical: vs(4),
  },
  fieldLine: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.6)',
    marginTop: vs(-20),
  },
  errorText: {
    color: '#FFD0D0',
    fontSize: ms(13),
    textAlign: 'center',
    marginTop: vs(-12),
  },
  fieldLineError: {
    backgroundColor: '#FFD0D0',
  },
  fieldError: {
    color: '#FFD0D0',
    fontSize: ms(12),
    marginTop: vs(-20),
  },
  button: {
    backgroundColor: '#9B989D',
    borderRadius: s(48),
    height: vs(51),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#646464',
    marginTop: vs(8),
  },
  buttonActive: {
    backgroundColor: '#7D08FA',
    borderColor: '#6A00D4',
  },
  buttonText: {
    color: '#FFF',
    fontSize: ms(20),
    fontWeight: '700',
  },
  linkText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: ms(15),
    textAlign: 'center',
  },
  linkHighlight: {
    color: '#FFF',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
