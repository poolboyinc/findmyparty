import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, type TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { PasswordToggle } from '@/components/account/password-toggle';
import { AuthField } from '@/components/ui/auth-field';
import { AuthHeader } from '@/components/ui/auth-header';
import { PrimaryButton } from '@/components/ui/primary-button';
import { enterApp, useLogin } from '@/hooks/useAuth';
import { colors, layout, spacing, typography } from '@/theme';

// The first field takes an email or a username; the server tells them apart by the "@".
// Checks here are minimal so real inputs (plus-addressed emails, dotted usernames) are not refused.
const MIN_IDENTIFIER_LENGTH = 3;

export default function LoginPage() {
  const { email, setEmail, password, setPassword, error, loading, login } = useLogin();
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const identifierValid = email.trim().length >= MIN_IDENTIFIER_LENGTH;
  const identifierError = submitAttempted && !identifierValid ? 'Enter your email or username.' : null;
  const passwordError = submitAttempted && password.length === 0 ? 'Enter your password.' : null;

  const handleLogIn = async () => {
    setSubmitAttempted(true);
    if (!identifierValid || password.length === 0 || loading) return;
    const signedIn = await login();
    if (signedIn) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void enterApp();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  return (
    <View style={styles.root}>
      <AuthHeader title="Log in" disabled={loading} />

      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.form}>
            <AuthField
              placeholder="Email or username"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
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
              onSubmitEditing={handleLogIn}
              accessibilityLabel="Password"
              error={passwordError}
              editable={!loading}
              trailingSlot={
                <PasswordToggle visible={passwordVisible} onToggle={() => setPasswordVisible((v) => !v)} disabled={loading} />
              }
            />

            <Pressable
              onPress={() => router.push('/forgot-password')}
              disabled={loading}
              hitSlop={layout.hitSlop}
              accessibilityRole="link"
              accessibilityLabel="Forgot password?"
              style={styles.forgot}
            >
              <Text style={styles.link}>Forgot password?</Text>
            </Pressable>

            {error ? (
              <Text style={styles.formError} accessibilityRole="alert" accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}

            <PrimaryButton label="Log in" onPress={handleLogIn} loading={loading} accessibilityHint="Signs you in to your account" />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>No account yet?</Text>
            <Pressable
              onPress={() => router.replace('/register')}
              disabled={loading}
              hitSlop={layout.hitSlop}
              accessibilityRole="link"
              accessibilityLabel="Sign up"
            >
              <Text style={styles.link}>Sign up</Text>
            </Pressable>
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
  fill: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  form: {
    gap: spacing.base,
  },
  forgot: {
    alignSelf: 'flex-end',
    paddingVertical: spacing.xs,
  },
  link: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.tint,
  },
  formError: {
    ...typography.subheadline,
    color: colors.danger,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 'auto',
    paddingTop: spacing.xl,
  },
  footerText: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
});
