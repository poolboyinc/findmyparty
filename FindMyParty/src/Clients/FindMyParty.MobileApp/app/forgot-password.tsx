import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';
import { AuthField } from '@/components/ui/auth-field';
import { AuthHeader } from '@/components/ui/auth-header';
import { PrimaryButton } from '@/components/ui/primary-button';
import { colors, layout, spacing, typography, weights } from '@/theme';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');

  const emailError =
    (emailTouched || submitAttempted) && email.length > 0 && !EMAIL_REGEX.test(email.trim())
      ? 'Please enter a valid email address.'
      : submitAttempted && email.trim().length === 0
        ? 'Email is required.'
        : null;

  const formValid = EMAIL_REGEX.test(email.trim());

  const handleSubmit = async () => {
    setSubmitAttempted(true);
    if (!formValid) return;

    setSubmitting(true);
    // TODO: wire to backend POST /auth/forgot-password when the endpoint exists.
    // Today this is a UI-only stub — show the success state without a network call.
    await new Promise((resolve) => setTimeout(resolve, 600));
    setSubmitting(false);
    setSentEmail(email.trim());
    setSent(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // Use `replace` so navigating back from /login doesn't surface the stale success
  // view. Component unmount clears local state.
  const handleBackToLogin = () => {
    router.replace('/login');
  };

  return (
    <View style={styles.root}>
      <AuthHeader title="Forgot Password" disabled={submitting} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {sent ? (
            <Animated.View entering={FadeIn.duration(220)} style={styles.successWrap}>
              <View style={styles.successIcon}>
                <Ionicons name="mail-outline" size={48} color={colors.tint} />
              </View>
              <Text style={styles.successTitle} accessibilityRole="header">
                Check your email
              </Text>
              <Text style={styles.successBody}>
                We&apos;ve sent password reset instructions to
              </Text>
              <Text
                style={styles.successEmail}
                numberOfLines={1}
                ellipsizeMode="middle"
                accessibilityLabel={`Email: ${sentEmail}`}
              >
                {sentEmail}
              </Text>
              <View style={styles.successCta}>
                <PrimaryButton
                  label="Back to log in"
                  onPress={handleBackToLogin}
                  accessibilityHint="Returns to the log in screen"
                />
              </View>
            </Animated.View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.helper}>
                Enter the email associated with your account and we&apos;ll send you
                instructions to reset your password.
              </Text>
              <AuthField
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                onBlur={() => setEmailTouched(true)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
                autoComplete="email"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                accessibilityLabel="Email"
                error={emailError}
                editable={!submitting}
              />
              <PrimaryButton
                label="Send reset link"
                onPress={handleSubmit}
                disabled={submitting}
                loading={submitting}
                accessibilityHint="Sends password reset instructions to your email"
              />
            </View>
          )}
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
  helper: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    marginBottom: spacing.xs,
  },
  successWrap: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.xxl,
  },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  successTitle: {
    ...typography.title2,
    fontWeight: weights.bold,
    color: colors.label,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  successBody: {
    ...typography.body,
    color: colors.labelSecondary,
    textAlign: 'center',
  },
  successEmail: {
    ...typography.bodyEmphasized,
    color: colors.label,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    maxWidth: '100%',
  },
  successCta: {
    width: '100%',
    marginTop: spacing.xxl,
  },
});
