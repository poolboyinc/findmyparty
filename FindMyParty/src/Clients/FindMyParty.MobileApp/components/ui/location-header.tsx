import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { colors, layout, spacing, typography, weights } from '@/theme';

type Props = {
  /** Selected city, or `null` when the user hasn't picked one yet. */
  city: string | null;
  onPress: () => void;
};

/**
 * "Current Location · Podgorica ⌄" header. Entire stacked block is one tap
 * target with hitSlop so VoiceOver and touch hit the full 44pt minimum.
 * When `city` is null, renders the first-launch prompt "Choose your city".
 */
export function LocationHeader({ city, onPress }: Props) {
  const hasCity = !!city;

  return (
    <Pressable
      onPress={onPress}
      hitSlop={layout.hitSlop}
      accessibilityRole="button"
      accessibilityLabel={hasCity ? `Change city — currently ${city}` : 'Choose your city'}
      style={styles.wrap}
    >
      {hasCity ? (
        <Text style={styles.caption}>Current Location</Text>
      ) : null}
      <View style={styles.cityRow}>
        <Text style={styles.city}>{hasCity ? city : 'Choose your city'}</Text>
        <Icon sfSymbol="chevron.down" ionicon="chevron-down" size={18} color={colors.label} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 2,
  },
  caption: {
    ...typography.caption1,
    color: colors.labelSecondary,
    fontWeight: weights.medium,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  city: {
    ...typography.title3,
    color: colors.label,
    fontWeight: weights.semibold,
  },
});
