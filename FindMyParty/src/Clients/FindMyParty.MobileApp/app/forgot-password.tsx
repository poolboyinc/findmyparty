import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { AuthStage } from '@/components/account/auth-stage';
import { FlatButton } from '@/components/account/provider-button';
import { AuthField } from '@/components/ui/auth-field';
import { useForgotPassword } from '@/hooks/queries';
import { errorText } from '@/services/errorText';
import { colors, layout, spacing, typography } from '@/theme';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * "Forgot password?": asks the server to mail a reset link. The server answers the same whether or not
 * the address has an account, so the screen does too. The link opens `reset-password?token=…`.
 */
export default function ForgotPasswordPage() {
  // Log in passes what was typed there when it looks like an email.
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email && EMAIL_REGEX.test(params.email) ? params.email : '');
  const [submitted, setSubmitted] = useState(false);
  const forgot = useForgotPassword();

  const emailValid = EMAIL_REGEX.test(email.trim());
  const emailError = submitted && !emailValid ? (email.trim() ? 'That does not look like an email address.' : 'Enter your email.') : null;
  const sent = forgot.isSuccess;

  const send = () => {
    setSubmitted(true);
    if (!emailValid || forgot.isPending) return;
    forgot.mutate(email.trim(), {
      onSuccess: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
      onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
    });
  };

  return (
    <AuthStage
      kicker="Password"
      title={sent ? 'Check your mail.' : 'Forgot it?'}
      subtitle={
        sent
          ? 'The link works for two hours.'
          : 'Tell us the email on your account and we send you a link to set a new password.'
      }
      busy={forgot.isPending}
      footer={
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))}
          disabled={forgot.isPending}
          hitSlop={layout.hitSlop}
          accessibilityRole="link"
          accessibilityLabel="Back to log in"
        >
          <Text style={styles.link}>Back to log in</Text>
        </Pressable>
      }
    >
      {sent ? (
        <>
          <Text style={styles.note}>
            {`If ${email.trim()} has an account, the mail is on its way. Nothing there? Look in spam, or send it again.`}
          </Text>
          <FlatButton
            tone="surface"
            label="Send it again"
            onPress={() => forgot.mutate(email.trim())}
            accessibilityHint="Sends another reset link"
          />
        </>
      ) : (
        <>
          <AuthField
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            autoComplete="email"
            returnKeyType="send"
            onSubmitEditing={send}
            accessibilityLabel="Email"
            error={emailError}
            editable={!forgot.isPending}
          />
          {forgot.isError ? (
            <Text style={styles.formError} accessibilityRole="alert" accessibilityLiveRegion="polite">
              {errorText(forgot.error)}
            </Text>
          ) : null}
          <FlatButton
            tone="action"
            label="Send reset link"
            onPress={send}
            loading={forgot.isPending}
            accessibilityHint="Mails you a link to set a new password"
          />
        </>
      )}
    </AuthStage>
  );
}

const styles = StyleSheet.create({
  link: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.tint,
  },
  note: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    marginBottom: spacing.xs,
  },
  formError: {
    ...typography.subheadline,
    color: colors.danger,
  },
});
