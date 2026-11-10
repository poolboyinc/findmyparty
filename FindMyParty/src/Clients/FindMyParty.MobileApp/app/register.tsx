import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, type TextInput } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { PasswordToggle } from '@/components/account/password-toggle';
import { AuthField } from '@/components/ui/auth-field';
import { AuthStage } from '@/components/account/auth-stage';
import { FlatButton } from '@/components/account/provider-button';
import { enterApp, useRegister } from '@/hooks/useAuth';
import { colors, layout, spacing, typography } from '@/theme';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// 3 to 20 letters, numbers or underscores, no spaces.
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
// The server's rule (Identity options in the API's Program.cs).
const PASSWORD_RULE = 'At least 8 characters, with a number and a lowercase letter.';

function passwordOk(password: string): boolean {
  return password.length >= 8 && /[0-9]/.test(password) && /[a-z]/.test(password);
}

/** An empty field only complains after a submit; a filled-in wrong one as soon as it has been left. */
function fieldError(
  valid: boolean,
  empty: boolean,
  touched: boolean,
  submitted: boolean,
  emptyText: string,
  wrongText: string,
): string | null {
  if (valid) return null;
  if (empty) return submitted ? emptyText : null;
  return touched || submitted ? wrongText : null;
}

export default function RegisterPage() {
  const { userName, setUserName, email, setEmail, password, setPassword, error, loading, register } = useRegister();

  const [confirm, setConfirm] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const usernameValid = USERNAME_REGEX.test(userName.trim());
  const emailValid = EMAIL_REGEX.test(email.trim());
  const passwordValid = passwordOk(password);
  const confirmValid = confirm === password;

  const usernameError = fieldError(
    usernameValid,
    userName.trim().length === 0,
    usernameTouched,
    submitAttempted,
    'Choose a username.',
    '3 to 20 letters, numbers or underscores, no spaces.',
  );
  const emailError = fieldError(
    emailValid,
    email.trim().length === 0,
    emailTouched,
    submitAttempted,
    'Enter your email.',
    'That does not look like an email address.',
  );
  // The rule always stands under the field; it turns into the error once the password falls short of it.
  const passwordError = fieldError(passwordValid, password.length === 0, passwordTouched, submitAttempted, PASSWORD_RULE, PASSWORD_RULE);
  const confirmError = fieldError(
    confirmValid,
    confirm.length === 0,
    confirmTouched,
    submitAttempted,
    'Type the password again.',
    'The passwords do not match.',
  );

  const handleSignUp = async () => {
    setSubmitAttempted(true);
    if (!usernameValid || !emailValid || !passwordValid || !confirmValid || loading) return;
    const created = await register();
    if (created) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void enterApp({ newAccount: true });
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  return (
    <AuthStage
      kicker="New here"
      title="Join the night."
      subtitle="Make an account, then tell us what you go out for."
      busy={loading}
      footer={
        <>
            <Text style={styles.footerText}>Have an account?</Text>
            <Pressable
              onPress={() => router.replace('/login')}
              disabled={loading}
              hitSlop={layout.hitSlop}
              accessibilityRole="link"
              accessibilityLabel="Log in"
            >
              <Text style={styles.link}>Log in</Text>
            </Pressable>
        </>
      }
    >
            <AuthField
              placeholder="Username"
              value={userName}
              onChangeText={setUserName}
              onBlur={() => setUsernameTouched(true)}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
              autoComplete="username-new"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              accessibilityLabel="Username"
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
              onBlur={() => setPasswordTouched(true)}
              secureTextEntry={!passwordVisible}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              autoComplete="password-new"
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
              accessibilityLabel="Password"
              accessibilityHint={PASSWORD_RULE}
              helper={PASSWORD_RULE}
              error={passwordError}
              editable={!loading}
              trailingSlot={
                <PasswordToggle visible={passwordVisible} onToggle={() => setPasswordVisible((v) => !v)} disabled={loading} />
              }
            />
            <AuthField
              ref={confirmRef}
              placeholder="Confirm password"
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
              accessibilityLabel="Confirm password"
              error={confirmError}
              editable={!loading}
            />

            {error ? (
              <Text style={styles.formError} accessibilityRole="alert" accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}

            <FlatButton tone="action" label="Create account" onPress={handleSignUp} loading={loading} accessibilityHint="Creates your FindMyParty account" />
    </AuthStage>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.base,
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
