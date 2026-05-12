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
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRegister } from '@/hooks/useAuth';
import { colors, layout, spacing, typography } from '@/constants/theme';
import { AuthField } from '@/components/ui/auth-field';
import { PrimaryButton } from '@/components/ui/primary-button';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const insets = useSafeAreaInsets();
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
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const emailError =
    emailTouched && email.length > 0 && !EMAIL_REGEX.test(email.trim())
      ? 'Please enter a valid email address.'
      : null;

  const pwChecks = {
    length: password.length >= 8,
    digit: /[0-9]/.test(password),
    lower: /[a-z]/.test(password),
  };

  const formValid =
    userName.trim().length >= 2 &&
    EMAIL_REGEX.test(email.trim()) &&
    pwChecks.length &&
    pwChecks.digit &&
    pwChecks.lower;

  const handleSignUp = async () => {
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
      <LinearGradient
        colors={['rgba(157,78,255,0.18)', 'rgba(10,10,12,0)']}
        locations={[0, 1]}
        style={styles.spotlight}
        pointerEvents="none"
      />

      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={layout.hitSlop}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.5 }]}
        >
          <Ionicons name="chevron-back" size={28} color={colors.label} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>Find your next party in seconds.</Text>
          </View>

          <View style={styles.form}>
            <AuthField
              placeholder="Username"
              value={userName}
              onChangeText={setUserName}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
              autoComplete="username-new"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              accessibilityLabel="Username"
              leadingIcon={
                <Ionicons name="person-outline" size={18} color={colors.labelTertiary} />
              }
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
              leadingIcon={
                <Ionicons name="mail-outline" size={18} color={colors.labelTertiary} />
              }
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
              returnKeyType="done"
              onSubmitEditing={handleSignUp}
              accessibilityLabel="Password"
              leadingIcon={
                <Ionicons name="lock-closed-outline" size={18} color={colors.labelTertiary} />
              }
              trailingSlot={
                <Pressable
                  onPress={() => setPasswordVisible((v) => !v)}
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

            <View style={styles.hints}>
              <PwHint met={pwChecks.length} label="At least 8 characters" />
              <PwHint met={pwChecks.digit} label="At least 1 number" />
              <PwHint met={pwChecks.lower} label="At least 1 lowercase letter" />
            </View>

            {error ? (
              <Text style={styles.formError} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}

            <PrimaryButton
              label="Create account"
              onPress={handleSignUp}
              disabled={!formValid}
              loading={loading}
              accessibilityHint="Creates your FindMyParty account"
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Already have an account?{' '}
              <Text style={styles.footerLink} onPress={() => router.push('/login')}>
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
  spotlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 360,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: layout.screenMargin,
    paddingBottom: spacing.xxl,
  },
  titleBlock: {
    marginTop: spacing.lg,
    marginBottom: spacing.xxl,
    gap: spacing.xs,
  },
  title: {
    ...typography.largeTitle,
    fontWeight: '700',
    color: colors.label,
  },
  subtitle: {
    ...typography.subheadline,
    color: colors.labelSecondary,
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
    color: colors.brandLight,
    fontWeight: '600',
  },
});
