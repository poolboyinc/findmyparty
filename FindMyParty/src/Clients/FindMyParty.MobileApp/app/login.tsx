import { useRef, useState } from 'react';
import {
  Image,
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
import { useLogin } from '@/hooks/useAuth';
import {
  BRAND_GRADIENT,
  colors,
  layout,
  spacing,
  typography,
} from '@/constants/theme';
import { AuthField } from '@/components/ui/auth-field';
import { PrimaryButton } from '@/components/ui/primary-button';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidEmail = (v: string) => EMAIL_REGEX.test(v.trim());

const HALO = 140;
const LOGO = 88;

export default function LoginPage() {
  const insets = useSafeAreaInsets();
  const { email, setEmail, password, setPassword, error, loading, login } = useLogin();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const looksLikeEmail = email.includes('@');
  const emailError =
    emailTouched && looksLikeEmail && !isValidEmail(email)
      ? 'Please enter a valid email address.'
      : null;

  const formValid =
    email.trim().length >= 2 &&
    (!looksLikeEmail || isValidEmail(email)) &&
    password.length > 0;

  const handleSignIn = async () => {
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
          <View style={styles.brandWrap}>
            <View style={styles.haloWrap}>
              <LinearGradient
                colors={BRAND_GRADIENT.colors}
                locations={BRAND_GRADIENT.locations}
                style={styles.halo}
              />
              <Image
                source={require('@/assets/images/fmp_logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to keep the party going.</Text>
          </View>

          <View style={styles.form}>
            <AuthField
              placeholder="Email or username"
              value={email}
              onChangeText={setEmail}
              onBlur={() => setEmailTouched(true)}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              autoComplete="username"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              accessibilityLabel="Email or username"
              error={emailError}
              leadingIcon={
                <Ionicons name="person-outline" size={18} color={colors.labelTertiary} />
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
              textContentType="password"
              autoComplete="current-password"
              returnKeyType="done"
              onSubmitEditing={handleSignIn}
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

            {error ? (
              <Text style={styles.formError} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}

            <PrimaryButton
              label="Sign in"
              onPress={handleSignIn}
              disabled={!formValid}
              loading={loading}
              accessibilityHint="Signs you into your account"
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Don't have an account?{' '}
              <Text style={styles.footerLink} onPress={() => router.push('/register')}>
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
  brandWrap: {
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  haloWrap: {
    width: HALO,
    height: HALO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: HALO,
    height: HALO,
    borderRadius: HALO / 2,
    opacity: 0.35,
  },
  logo: {
    width: LOGO,
    height: LOGO,
  },
  titleBlock: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
    gap: spacing.xs,
  },
  title: {
    ...typography.largeTitle,
    fontWeight: '700',
    color: colors.label,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    textAlign: 'center',
  },
  form: {
    gap: spacing.base,
    marginBottom: spacing.xl,
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
