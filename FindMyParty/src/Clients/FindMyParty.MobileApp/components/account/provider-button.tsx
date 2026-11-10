import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, layout, radii, spacing, typography } from '@/theme';
import { PressableScale } from '@/components/afterglow/motion';

type Props = {
  label: string;
  /** `light`: white with dark text (Apple). `surface`: a flat dark block (Google). `action`: the violet primary. */
  tone: 'light' | 'surface' | 'action';
  icon?: ReactNode;
  onPress: () => void;
  /** This button's work is under way. */
  loading?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
};

/** The mock's 40 pt button on its 286 pt screen, scaled to a phone. */
const HEIGHT = layout.buttonHeight + spacing.xs;

const FILL = { light: colors.label, surface: colors.surfaceElevated, action: colors.action } as const;
const TEXT = { light: colors.ink, surface: colors.label, action: colors.label } as const;

/**
 * The tall flat buttons of the welcome and first run (S-01 to S-03): "Continue with …", "Sign up with email",
 * "Continue", "Light up my city". Flat fill, no outline, gives under the finger.
 */
export function FlatButton({ label, tone, icon, onPress, loading = false, disabled = false, accessibilityHint }: Props) {
  const inactive = disabled || loading;
  const off = disabled && !loading;
  const textColor = off ? colors.labelTertiary : TEXT[tone];

  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={[styles.button, { backgroundColor: off ? colors.fillTertiary : FILL[tone] }]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          <Text style={[styles.label, { color: textColor }]}>{label}</Text>
        </>
      )}
    </PressableScale>
  );
}

/** "Continue with …" on the welcome screen. */
export const ProviderButton = FlatButton;

const styles = StyleSheet.create({
  button: {
    minHeight: HEIGHT,
    borderRadius: radii.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  icon: {
    width: 22,
    alignItems: 'center',
  },
  label: {
    ...typography.bodyEmphasized,
  },
});
