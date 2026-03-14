import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Dimensions,
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ELLIPSE_SIZE = SCREEN_WIDTH * 2.2;

export default function LoginPage() {
  const insets = useSafeAreaInsets();
  const { email, setEmail, password, setPassword, error, loading, login } = useLogin();
  const [passwordVisible, setPasswordVisible] = useState(false);

  const handleSignIn = async () => {
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
        width: ELLIPSE_SIZE,
        height: ELLIPSE_SIZE,
        borderRadius: ELLIPSE_SIZE / 2,
        left: (SCREEN_WIDTH - ELLIPSE_SIZE) / 2,
      }]} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={26} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Sign In</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Form */}
      <View style={styles.form}>
        {/* Email */}
        <View style={styles.fieldRow}>
          <Ionicons name="mail-outline" size={28} color="#FFF" style={styles.fieldIcon} />
          <TextInput
            style={styles.fieldInput}
            placeholder="Email"
            placeholderTextColor="rgba(255,255,255,0.75)"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <View style={styles.fieldLine} />

        {/* Password */}
        <View style={styles.fieldRow}>
          <Ionicons name="lock-closed-outline" size={28} color="#FFF" style={styles.fieldIcon} />
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
              size={28}
              color="#FFF"
            />
          </TouchableOpacity>
        </View>
        <View style={styles.fieldLine} />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Sign In button */}
        <TouchableOpacity
          style={styles.button}
          onPress={handleSignIn}
          activeOpacity={0.85}
          disabled={loading}
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
    bottom: -SCREEN_WIDTH * 1.6,
    backgroundColor: '#7D08FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  form: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: '18%',
    gap: 28,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  fieldIcon: {
    width: 32,
  },
  fieldInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 22,
    fontWeight: '300',
    paddingVertical: 4,
  },
  fieldLine: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.6)',
    marginTop: -20,
  },
  errorText: {
    color: '#FFD0D0',
    fontSize: 13,
    textAlign: 'center',
    marginTop: -12,
  },
  button: {
    backgroundColor: '#9B989D',
    borderRadius: 48,
    height: 51,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#646464',
    marginTop: 8,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
  },
  linkText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    textAlign: 'center',
  },
  linkHighlight: {
    color: '#FFF',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
