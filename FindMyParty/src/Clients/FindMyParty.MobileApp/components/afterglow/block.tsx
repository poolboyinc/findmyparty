import { StyleSheet, Text, View } from 'react-native';
import { colors, radii } from '@/theme';

const TONES = {
  /** Live crowd. */
  crowd: colors.crowd,
  /** Earned: valid scan, perk. */
  earned: colors.earned,
  /** Paid: sponsored. The only use of amber. */
  paid: colors.paid,
  /** You, your route, friends. */
  you: colors.you,
  /** Plain emphasis. */
  light: colors.label,
} as const;

type Props = {
  label: string;
  tone?: keyof typeof TONES;
};

/**
 * A solid block with dark text: "Live, 200+", "Ad", "Sold out". Afterglow's replacement for
 * outlined pills. Flat colour, nearly square corners, no border, no glow.
 */
export function Block({ label, tone = 'crowd' }: Props) {
  return (
    <View style={[styles.block, { backgroundColor: TONES[tone] }]} accessibilityRole="text">
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    alignSelf: 'flex-start',
    borderRadius: radii.badge,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  label: {
    color: colors.ink,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
});
