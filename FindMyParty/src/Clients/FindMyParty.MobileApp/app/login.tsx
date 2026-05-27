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
import { useLogin } from '@/hooks/useAuth';
import { AuthField } from '@/components/ui/auth-field';
import { AuthHeader } from '@/components/ui/auth-header';
import { PrimaryButton } from '@/components/ui/primary-button';
import { colors, layout, spacing, typography, weights } from '@/theme';

// The identifier field accepts either an email or a username — backend
// disambiguates by checking for '@'. Frontend validation is minimal so
// legitimate inputs (plus-addressed emails, dotted usernames, etc.) aren't
// falsely rejected.
const MIN_IDENTIFIER_LENGTH = 3;

export default function LoginPage() {
  const { email, setEmail, password, setPassword, error, loading, login } = useLogin();
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const identifierError =
    submitAttempted && email.trim().length < MIN_IDENTIFIER_LENGTH
      ? 'Enter your email or username'
      : null;

  const passwordError =
    submitAttempted && password.length === 0 ? 'Password is required.' : null;

  const formValid =
    email.trim().length >= MIN_IDENTIFIER_LENGTH && password.length > 0;

  const handleSignIn = async () => {
    setSubmitAttempted(true);
    if (!formValid) return;
    const success = await login();
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  return (
    <View style={styles.root}>
      <AuthHeader title="Log In" disabled={loading} />

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
              placeholder="Email or username"
              value={email}
              onChangeText={setEmail}
              keyboardType="default"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
              autoComplete="username"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              accessibilityLabel="Email or username"
              error={identifierError}
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
              textContentType="password"
              autoComplete="current-password"
              returnKeyType="done"
              onSubmitEditing={handleSignIn}
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

            <Pressable
              onPress={() => router.push('/forgot-password')}
              disabled={loading}
              hitSlop={layout.hitSlop}
              accessibilityRole="link"
              accessibilityLabel="Forgot password"
              accessibilityHint="Opens password recovery"
              style={styles.forgotWrap}
            >
              <Text style={[styles.forgot, loading && styles.forgotDisabled]}>
                Forgot password?
              </Text>
            </Pressable>

            {error ? (
              <Text style={styles.formError} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}

            <PrimaryButton
              label="Log In"
              variant="gradient"
              onPress={handleSignIn}
              disabled={loading}
              loading={loading}
              accessibilityHint="Signs you into your account"
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Don&apos;t have an account?{' '}
              <Text
                style={[styles.footerLink, loading && styles.footerLinkDisabled]}
                onPress={loading ? undefined : () => router.push('/register')}
                accessibilityRole="link"
              >
                Sign up
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
  forgotWrap: {
    alignSelf: 'flex-end',
    paddingVertical: spacing.xs,
  },
  forgot: {
    ...typography.subheadline,
    fontWeight: weights.medium,
    color: colors.brand.magenta,
  },
  forgotDisabled: {
    color: colors.labelTertiary,
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
