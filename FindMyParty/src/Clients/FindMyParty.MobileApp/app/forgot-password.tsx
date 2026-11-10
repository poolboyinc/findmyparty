import { StyleSheet, Text, View } from 'react-native';
import { emailSupport } from '@/components/account/support';
import { AuthHeader } from '@/components/ui/auth-header';
import { PrimaryButton } from '@/components/ui/primary-button';
import { colors, layout, spacing, typography } from '@/theme';

/** The server cannot reset a password by email yet, so this screen says so and points at support. */
export default function ForgotPasswordPage() {
  return (
    <View style={styles.root}>
      <AuthHeader title="Reset your password" />
      <View style={styles.body}>
        <Text style={styles.text}>
          Resetting by email is not available yet. Write to us and we will reset it for you.
        </Text>
        <PrimaryButton
          label="Email support"
          onPress={() => emailSupport('Password reset')}
          accessibilityHint="Opens your mail app with a message to support"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  body: {
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.sm,
    gap: spacing.xl,
  },
  text: {
    ...typography.body,
    color: colors.labelSecondary,
  },
});
