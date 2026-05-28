import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors, layout, radii, spacing, typography } from '@/theme';

type Variant = 'primary' | 'secondary' | 'gradient' | 'destructive';

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  leadingIcon?: ReactNode;
  accessibilityHint?: string;
};

export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  leadingIcon,
  accessibilityHint,
}: Props) {
  const inactive = disabled || loading;
  const isGradient = variant === 'gradient' && !inactive;

  // Press-start haptic acknowledges the input. The screen-level submit handler
  // fires a `notification` haptic on the result (success/error) — two distinct
  // tactile moments per HIG feedback guidance.
  const handlePressIn = () => {
    if (inactive) return;
    Haptics.selectionAsync();
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'gradient' && styles.gradientBase,
        variant === 'destructive' && styles.destructive,
        inactive && styles.disabled,
        pressed && !inactive && styles.pressed,
      ]}
    >
      {isGradient ? (
        <LinearGradient
          colors={colors.brand.authGradient.colors}
          locations={colors.brand.authGradient.locations}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      {loading ? (
        <ActivityIndicator color={colors.label} />
      ) : (
        <View style={styles.row}>
          {leadingIcon ? <View style={styles.icon}>{leadingIcon}</View> : null}
          <Text
            style={[
              styles.label,
              inactive && styles.labelDisabled,
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: layout.buttonHeight,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  primary: {
    backgroundColor: colors.tint,
  },
  secondary: {
    backgroundColor: colors.surfaceElevated,
  },
  gradientBase: {
    // Background painted by the absolutely-positioned LinearGradient child.
    // Falls back to the disabled fill when `inactive` overrides this style.
    backgroundColor: 'transparent',
  },
  destructive: {
    // iOS-system red action — used for the consumer "Cancel Booking" CTA inside
    // the confirm sheet. White label preserved via the shared `styles.label`.
    backgroundColor: colors.danger,
  },
  disabled: {
    backgroundColor: colors.fillTertiary,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  icon: {
    marginRight: 0,
  },
  label: {
    ...typography.bodyEmphasized,
    color: colors.label,
  },
  labelDisabled: {
    color: colors.labelTertiary,
  },
});
