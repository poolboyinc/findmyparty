import { StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { PressableScale } from '@/components/afterglow/motion';
import { colors, layout, radii, spacing, typography, weights } from '@/theme';

type Props<T> = {
  /** Read out with each choice, e.g. "Age limit". */
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

/**
 * One choice out of a few, side by side: the chosen one is a solid white block with dark text, the rest
 * sit flat on the surface. No outlines.
 */
export function ChoiceRow<T extends string | number | null>({ label, options, value, onChange }: Props<T>) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((option) => {
        const chosen = option.value === value;
        return (
          <PressableScale
            key={String(option.value)}
            haptic={false}
            onPress={() => {
              if (chosen) return;
              Haptics.selectionAsync();
              onChange(option.value);
            }}
            style={[styles.choice, chosen ? styles.chosen : styles.plain]}
            accessibilityRole="radio"
            accessibilityLabel={`${label}, ${option.label}`}
            accessibilityState={{ selected: chosen, checked: chosen }}
          >
            <Text style={chosen ? styles.chosenLabel : styles.plainLabel}>{option.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  choice: {
    flex: 1,
    minHeight: layout.minTouchTarget,
    borderRadius: radii.chip,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  plain: {
    backgroundColor: colors.surface,
  },
  chosen: {
    backgroundColor: colors.label,
  },
  plainLabel: {
    ...typography.subheadline,
    fontWeight: weights.semibold,
    color: colors.labelSecondary,
  },
  chosenLabel: {
    ...typography.subheadline,
    fontWeight: weights.semibold,
    color: colors.ink,
  },
});
