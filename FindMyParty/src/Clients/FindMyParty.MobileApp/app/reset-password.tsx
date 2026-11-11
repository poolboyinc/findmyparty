import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, type TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { AuthStage } from '@/components/account/auth-stage';
import { PASSWORD_RULE, passwordOk } from '@/components/account/password-rule';
import { PasswordToggle } from '@/components/account/password-toggle';
import { FlatButton } from '@/components/account/provider-button';
import { AuthField } from '@/components/ui/auth-field';
import { useResetPassword } from '@/hooks/queries';
import { ApiError } from '@/services/apiClient';
import { errorText } from '@/services/errorText';
import { colors, layout, typography } from '@/theme';

/**
 * Where the reset mail's link lands (`{public}/reset?token=…` opens `reset-password?token=…`): the new
 * password twice, "Set password", then the log-in screen. Open to anyone; the token is the proof.
 */
export default function ResetPasswordPage() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const reset = useResetPassword();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const confirmRef = useRef<TextInput>(null);

  const valid = passwordOk(password);
  const matches = confirm === password;
  const passwordError = submitted && !valid ? PASSWORD_RULE : null;
  const confirmError = submitted && valid && !matches ? (confirm ? 'The passwords do not match.' : 'Type the password again.') : null;

  const toLogin = () => {
    if (router.canDismiss()) router.dismissAll();
    router.replace({ pathname: '/login', params: { reset: '1' } });
  };

  const submit = () => {
    setSubmitted(true);
    if (!token || !valid || !matches || reset.isPending) return;
    reset.mutate(
      { token, newPassword: password },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          toLogin();
        },
        onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
      },
    );
  };

  const askAgain = (
    <Pressable
      onPress={() => router.replace('/forgot-password')}
      disabled={reset.isPending}
      hitSlop={layout.hitSlop}
      accessibilityRole="link"
      accessibilityLabel="Send a new link"
    >
      <Text style={styles.link}>Send a new link</Text>
    </Pressable>
  );

  // Opened without a token (a link cut short): nothing to set a password with.
  if (!token) {
    return (
      <AuthStage
        kicker="Password"
        title="This link is not whole."
        subtitle="Open the link from the mail again, or ask for a new one."
      >
        <FlatButton tone="action" label="Send a new link" onPress={() => router.replace('/forgot-password')} />
      </AuthStage>
    );
  }

  // An expired or used link: say so and offer a new one instead of the form.
  const expired = reset.error instanceof ApiError && reset.error.code === 'reset_invalid';

  return (
    <AuthStage
      kicker="Password"
      title="Set a new password."
      subtitle="Pick the password you will log in with from now on."
      busy={reset.isPending}
      footer={expired ? undefined : askAgain}
    >
      <AuthField
        placeholder="New password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="newPassword"
        autoComplete="password-new"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        accessibilityLabel="New password"
        accessibilityHint={PASSWORD_RULE}
        helper={PASSWORD_RULE}
        error={passwordError}
        editable={!reset.isPending}
        trailingSlot={<PasswordToggle visible={visible} onToggle={() => setVisible((v) => !v)} disabled={reset.isPending} />}
      />
      <AuthField
        ref={confirmRef}
        placeholder="New password again"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="newPassword"
        autoComplete="password-new"
        returnKeyType="done"
        onSubmitEditing={submit}
        accessibilityLabel="New password again"
        error={confirmError}
        editable={!reset.isPending}
      />

      {reset.isError ? (
        <Text style={styles.formError} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {errorText(reset.error)}
        </Text>
      ) : null}

      {expired ? (
        <FlatButton tone="action" label="Send a new link" onPress={() => router.replace('/forgot-password')} />
      ) : (
        <FlatButton
          tone="action"
          label="Set password"
          onPress={submit}
          loading={reset.isPending}
          accessibilityHint="Sets your new password, then opens log in"
        />
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
  formError: {
    ...typography.subheadline,
    color: colors.danger,
  },
});
