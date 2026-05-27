import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Icon } from '@/components/ui/icon';
import { colors, layout, radii, spacing, typography, weights } from '@/theme';

type Props = {
  /** Persistent label rendered above the row. */
  label: string;
  /** Current display value (e.g. a formatted date). */
  value: string;
  /** Optional leading glyph slot (an `Icon`, etc.). */
  icon?: ReactNode;
  /** Opens the underlying native picker — the picker's mount/state lives in the
   *  parent screen; this component is presentation only. */
  onPress: () => void;
  disabled?: boolean;
};

/**
 * Presentation-only picker row: a persistent label, the current value, and a
 * trailing chevron. Pressing it calls `onPress`; the parent owns the actual
 * `DateTimePicker` (or other) mount and state. Matches the `FormField` fill,
 * border, height, and radius so date/time pickers sit flush with text inputs.
 *
 * Usage:
 *   <PickerField label="Date" value="27 May 2026" onPress={openDatePicker}
 *     icon={<Icon sfSymbol="calendar" ionicon="calendar-outline" size={20} />} />
 */
export function PickerField({ label, value, icon, onPress, disabled = false }: Props) {
  const handlePress = () => {
    if (disabled) return;
    Haptics.selectionAsync();
    onPress();
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        accessibilityHint="Opens a picker"
        accessibilityState={{ disabled }}
        style={({ pressed }) => [
          styles.field,
          pressed && !disabled && styles.fieldPressed,
          disabled && styles.fieldDisabled,
        ]}
      >
        {icon ? <View style={styles.leading}>{icon}</View> : null}
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
        <Icon
          sfSymbol="chevron.right"
          ionicon="chevron-forward"
          size={16}
          color={colors.labelTertiary}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  label: {
    ...typography.subheadline,
    fontWeight: weights.semibold,
    color: colors.labelSecondary,
    paddingHorizontal: spacing.xs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.field,
    borderWidth: 1,
    borderColor: colors.hairline,
    height: layout.fieldHeightTall,
    paddingHorizontal: spacing.base,
    gap: spacing.md,
  },
  fieldPressed: {
    opacity: 0.85,
  },
  fieldDisabled: {
    opacity: 0.4,
  },
  leading: {
    width: 22,
    alignItems: 'center',
  },
  value: {
    flex: 1,
    ...typography.body,
    color: colors.label,
  },
});
