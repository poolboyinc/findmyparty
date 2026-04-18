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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useRegister } from '@/hooks/useAuth';
import { s, vs, ms } from '@/constants/responsive';
import { AmbientBackdrop } from '@/components/ui/ambient-backdrop';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function PwHint({ met, label }: { met: boolean; label: string }) {
  return (
    <View style={styles.pwHintRow}>
      <Ionicons
        name={met ? 'checkmark-circle' : 'ellipse-outline'}
        size={ms(14)}
        color={met ? '#A8F0C6' : 'rgba(255,255,255,0.5)'}
      />
      <Text style={[styles.pwHintText, met && styles.pwHintTextMet]}>{label}</Text>
    </View>
  );
}

export default function RegisterPage() {
  const insets = useSafeAreaInsets();
  const { userName, setUserName, email, setEmail, password, setPassword, error, loading, register } = useRegister();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const emailInvalid = emailTouched && email.length > 0 && !EMAIL_REGEX.test(email.trim());
  const pwChecks = {
    length: password.length >= 8,
    digit: /[0-9]/.test(password),
    lower: /[a-z]/.test(password),
  };

  const nameValid = userName.trim().length >= 2;
  const formValid =
    nameValid &&
    EMAIL_REGEX.test(email.trim()) &&
    pwChecks.length && pwChecks.digit && pwChecks.lower;

  const handleSignUp = async () => {
    if (!formValid) return;
    const success = await register();
    if (success) router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <AmbientBackdrop variant="intense" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={ms(26)} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Sign Up</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Form */}
      <View style={styles.form}>
        {/* Name */}
        <View style={styles.fieldRow}>
          <Ionicons name="person-outline" size={ms(28)} color="#FFF" style={styles.fieldIcon} />
          <TextInput
            style={styles.fieldInput}
            placeholder="Username"
            placeholderTextColor="rgba(255,255,255,0.75)"
            value={userName}
            onChangeText={setUserName}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <View style={styles.fieldLine} />

        {/* Email */}
        <View style={styles.fieldRow}>
          <Ionicons name="mail-outline" size={ms(28)} color="#FFF" style={styles.fieldIcon} />
          <TextInput
            style={styles.fieldInput}
            placeholder="Email"
            placeholderTextColor="rgba(255,255,255,0.75)"
            value={email}
            onChangeText={setEmail}
            onBlur={() => setEmailTouched(true)}
            keyboardType="email-address"
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
            onChangeText={(v) => { setPassword(v); setPasswordTouched(true); }}
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
        {passwordTouched && (
          <View style={styles.pwHints}>
            <PwHint met={pwChecks.length} label="At least 8 characters" />
            <PwHint met={pwChecks.digit} label="At least 1 number" />
            <PwHint met={pwChecks.lower} label="At least 1 lowercase letter" />
          </View>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Sign Up button */}
        <TouchableOpacity
          style={[styles.button, formValid && styles.buttonActive]}
          onPress={handleSignUp}
          activeOpacity={0.85}
          disabled={loading || !formValid}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.buttonText}>Sign Up</Text>
          )}
        </TouchableOpacity>

        {/* Sign in link */}
        <TouchableOpacity onPress={() => router.push('/login')} activeOpacity={0.7}>
          <Text style={styles.linkText}>
            Already have an account?{'  '}
            <Text style={styles.linkHighlight}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#05020A',
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
    paddingTop: '12%',
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
  pwHints: {
    gap: vs(6),
    marginTop: vs(-20),
  },
  pwHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s(6),
  },
  pwHintText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: ms(12),
  },
  pwHintTextMet: {
    color: '#A8F0C6',
  },
  button: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: s(48),
    height: vs(54),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    marginTop: vs(8),
  },
  buttonActive: {
    backgroundColor: '#B026FF',
    borderColor: 'rgba(255,255,255,0.28)',
    shadowColor: '#B026FF',
    shadowOpacity: 0.7,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
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
