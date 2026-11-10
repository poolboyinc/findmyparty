import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, layout, radii, spacing, typography } from '@/theme';
import { PressableScale } from '@/components/afterglow/motion';

type Props = {
  label: string;
  /** `light`: white with dark text (Apple). `surface`: a flat dark block (Google). */
  tone: 'light' | 'surface';
  icon: ReactNode;
  onPress: () => void;
  /** This provider's sign-in is under way. */
  loading?: boolean;
  disabled?: boolean;
};

/** "Continue with …" on the welcome screen. Flat fill, no outline. */
export function ProviderButton({ label, tone, icon, onPress, loading = false, disabled = false }: Props) {
  const inactive = disabled || loading;
  const textColor = tone === 'light' ? colors.ink : colors.label;

  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={[styles.button, tone === 'light' ? styles.light : styles.surface]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          <View style={styles.icon}>{icon}</View>
          <Text style={[styles.label, { color: textColor }]}>{label}</Text>
        </>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: layout.buttonHeight,
    borderRadius: radii.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  light: {
    backgroundColor: colors.label,
  },
  surface: {
    backgroundColor: colors.surfaceElevated,
  },
  icon: {
    width: 22,
    alignItems: 'center',
  },
  label: {
    ...typography.bodyEmphasized,
  },
});
