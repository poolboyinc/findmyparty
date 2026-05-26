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
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AuthField } from '@/components/ui/auth-field';
import { AuthHeader } from '@/components/ui/auth-header';
import { PrimaryButton } from '@/components/ui/primary-button';
import { authService } from '@/services/authService';
import { colors, layout, radii, spacing, typography, weights } from '@/theme';

// Single fixed logo size — intentionally smaller than the welcome screen's
// hero logo because the AuthHeader's "Host Portal" title already supplies the
// contextual signal. No wordmark is rendered beneath the mark.
const LOGO_SIZE = 104;

export default function AdminLoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [roleNotice, setRoleNotice] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const identifierError =
    submitAttempted && email.trim().length === 0
      ? 'Enter your email or username'
      : null;

  const passwordError =
    submitAttempted && password.length === 0 ? 'Password is required.' : null;

  const formValid = email.trim().length > 0 && password.length > 0;

  const handleLogin = async () => {
    setSubmitAttempted(true);
    setFormError(null);
    setRoleNotice(null);
    if (!formValid) return;
    setLoading(true);
    try {
      const success = await authService.login(email.trim(), password);
      if (!success) {
        setFormError('Invalid credentials. Please try again.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      const userInfo = await authService.getUserInfo();
      const roles = userInfo?.roles ?? [];
      if (roles.includes('Host') || roles.includes('Admin')) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/admin/dashboard');
      } else {
        await authService.logout();
        setRoleNotice(
          "This account isn't a host. If you're expecting access, contact your FindMyParty rep.",
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch {
      setFormError('Something went wrong. Please try again.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <AuthHeader title="Host Portal" disabled={loading} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoBlock}>
            <Image
              source={require('@/assets/images/fmp_logo.png')}
              style={styles.logo}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
              accessible={false}
            />
          </View>

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
              onSubmitEditing={handleLogin}
              accessibilityLabel="Password"
              error={passwordError}
              editable={!loading}
              trailingSlot={
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setPasswordVisible((v) => !v);
                  }}
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

            {formError ? (
              <Text style={styles.formError} accessibilityLiveRegion="polite">
                {formError}
              </Text>
            ) : null}

            {roleNotice ? (
              <Animated.View
                entering={FadeInDown.duration(180)}
                style={styles.roleNotice}
                accessibilityLiveRegion="polite"
              >
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color={colors.labelSecondary}
                />
                <Text style={styles.roleNoticeText}>{roleNotice}</Text>
              </Animated.View>
            ) : null}

            <PrimaryButton
              label="Sign In"
              variant="gradient"
              onPress={handleLogin}
              disabled={loading}
              loading={loading}
              accessibilityHint="Signs you into the host portal"
            />
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
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  logoBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.giant,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  form: {
    gap: spacing.base,
  },
  formError: {
    ...typography.footnote,
    color: colors.danger,
    textAlign: 'center',
  },
  roleNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.field,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
  },
  roleNoticeText: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    fontWeight: weights.medium,
    flexShrink: 1,
  },
});
