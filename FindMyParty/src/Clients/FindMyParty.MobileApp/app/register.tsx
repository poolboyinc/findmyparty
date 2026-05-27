import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRegister } from '@/hooks/useAuth';
import { AuthField } from '@/components/ui/auth-field';
import { AuthHeader } from '@/components/ui/auth-header';
import { PrimaryButton } from '@/components/ui/primary-button';
import { colors, layout, spacing, typography, weights } from '@/theme';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Backend constraint: 3–20 chars, alphanumeric + underscore, no spaces.
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

function PwHint({ met, label }: { met: boolean; label: string }) {
  return (
    <View style={hintStyles.row}>
      <Ionicons
        name={met ? 'checkmark-circle' : 'ellipse-outline'}
        size={14}
        color={met ? colors.success : colors.labelTertiary}
      />
      <Text style={[hintStyles.text, met && hintStyles.textMet]}>{label}</Text>
    </View>
  );
}

const hintStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  text: { ...typography.footnote, color: colors.labelTertiary },
  textMet: { color: colors.success },
});

export default function RegisterPage() {
  const {
    userName,
    setUserName,
    email,
    setEmail,
    password,
    setPassword,
    error,
    loading,
    register,
  } = useRegister();

  const [confirm, setConfirm] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const usernameError =
    (usernameTouched || submitAttempted) && userName.length > 0 && !USERNAME_REGEX.test(userName.trim())
      ? '3–20 letters, numbers, or underscores. No spaces.'
      : submitAttempted && userName.trim().length === 0
        ? 'Name is required.'
        : null;

  const emailError =
    (emailTouched || submitAttempted) && email.length > 0 && !EMAIL_REGEX.test(email.trim())
      ? 'Please enter a valid email address.'
      : submitAttempted && email.trim().length === 0
        ? 'Email is required.'
        : null;

  const pwChecks = {
    length: password.length >= 8,
    digit: /[0-9]/.test(password),
    lower: /[a-z]/.test(password),
  };
  const pwAllMet = pwChecks.length && pwChecks.digit && pwChecks.lower;

  const passwordError =
    submitAttempted && password.length === 0 ? 'Password is required.' : null;

  const confirmError =
    (confirmTouched || submitAttempted) && confirm.length > 0 && confirm !== password
      ? "Passwords don't match"
      : submitAttempted && confirm.length === 0
        ? 'Please confirm your password.'
        : null;

  const formValid =
    USERNAME_REGEX.test(userName.trim()) &&
    EMAIL_REGEX.test(email.trim()) &&
    pwAllMet &&
    confirm === password;

  const handleSignUp = async () => {
    setSubmitAttempted(true);
    if (!formValid) return;
    const success = await register();
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  return (
    <View style={styles.root}>
      <AuthHeader title="Sign Up" disabled={loading} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.form}>
            <AuthField
              placeholder="Name"
              value={userName}
              onChangeText={setUserName}
              onBlur={() => setUsernameTouched(true)}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
              autoComplete="username-new"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              accessibilityLabel="Name"
              error={usernameError}
              editable={!loading}
              maxLength={20}
            />
            <AuthField
              ref={emailRef}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              onBlur={() => setEmailTouched(true)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              accessibilityLabel="Email"
              error={emailError}
              editable={!loading}
            />
            <AuthField
              ref={passwordRef}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!passwordVisible}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              autoComplete="password-new"
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
              accessibilityLabel="Password"
              error={passwordError}
              editable={!loading}
              trailingSlot={
                <Pressable
                  onPress={() => setPasswordVisible((v) => !v)}
                  disabled={loading}
                  hitSlop={layout.hitSlop}
                  accessibilityRole="button"
                  accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                >
                  <Ionicons
                    name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.labelSecondary}
                  />
                </Pressable>
              }
            />

            {/* Live password rules — indicators are state-driven via `pwChecks`
                derived from the password value. Each rule fills in as the user
                types matching characters. Sits directly under Password so the
                user sees them before typing Confirm Password. */}
            <View style={styles.hints}>
              <PwHint met={pwChecks.length} label="8 characters" />
              <PwHint met={pwChecks.digit} label="1 number" />
              <PwHint met={pwChecks.lower} label="1 lowercase letter" />
            </View>

            <AuthField
              ref={confirmRef}
              placeholder="Confirm Password"
              value={confirm}
              onChangeText={setConfirm}
              onBlur={() => setConfirmTouched(true)}
              secureTextEntry={!passwordVisible}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              autoComplete="password-new"
              returnKeyType="done"
              onSubmitEditing={handleSignUp}
              accessibilityLabel="Confirm Password"
              error={confirmError}
              editable={!loading}
            />

            {error ? (
              <Text style={styles.formError} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}

            <PrimaryButton
              label="Sign Up"
              variant="gradient"
              onPress={handleSignUp}
              disabled={loading}
              loading={loading}
              accessibilityHint="Creates your FindMyParty account"
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Already have an account?{' '}
              <Text
                style={[styles.footerLink, loading && styles.footerLinkDisabled]}
                onPress={loading ? undefined : () => router.push('/login')}
                accessibilityRole="link"
              >
                Sign in
              </Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.giant,
    paddingBottom: spacing.xxl,
  },
  form: {
    gap: spacing.base,
  },
  hints: {
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    marginTop: -spacing.xs,
  },
  formError: {
    ...typography.footnote,
    color: colors.danger,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: spacing.xl,
  },
  footerText: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
  footerLink: {
    color: colors.brand.magenta,
    fontWeight: weights.semibold,
  },
  footerLinkDisabled: {
    color: colors.labelTertiary,
  },
});
