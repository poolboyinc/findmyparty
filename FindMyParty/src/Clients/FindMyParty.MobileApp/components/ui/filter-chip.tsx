import { StyleSheet, Text } from 'react-native';
import { PressableScale } from '@/components/afterglow/motion';
import { colors, layout, radii, spacing, typography } from '@/theme';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

/** A solid filter chip. Unselected it is a dark block with quiet text; selected it is a white block with dark text. */
export function FilterChip({ label, selected, onPress }: Props) {
  return (
    <PressableScale
      onPress={onPress}
      hitSlop={layout.hitSlop}
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radii.chip,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: colors.label,
  },
  label: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.labelSecondary,
  },
  labelSelected: {
    color: colors.ink,
  },
});
