import { StyleSheet, Text, View } from 'react-native';
import { alpha } from '@/components/pass/format';
import type { SoundShare } from '@/services/glow';
import { colors, radii, spacing, typography } from '@/theme';

/** Widest bar full violet, the next ones fainter, as in the mock. */
const STRENGTH = [1, 0.6, 0.3] as const;
const BAR = 8;

/** "Your sound": the guest's top genres as three bars in proportion, with their percentages under them. */
export function YourSound({ shares }: { shares: SoundShare[] }) {
  const spoken = shares.map((s) => `${s.label} ${s.share} percent`).join(', ');
  return (
    <View style={styles.card} accessible accessibilityRole="text" accessibilityLabel={`Your sound: ${spoken}`}>
      <View style={styles.bars}>
        {shares.map((s, i) => (
          <View
            key={s.label}
            style={[styles.bar, { flex: Math.max(1, s.share), backgroundColor: alpha(colors.quiet, STRENGTH[i] ?? 0.3) }]}
          />
        ))}
      </View>
      <View style={styles.labels}>
        {shares.map((s) => (
          <Text key={s.label} style={styles.label} numberOfLines={1}>
            {s.label} {s.share}%
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md + 1,
    gap: spacing.sm,
  },
  bars: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  bar: {
    height: BAR,
    borderRadius: BAR / 2,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  label: {
    ...typography.footnote,
    color: colors.labelSecondary,
    fontVariant: ['tabular-nums'],
  },
});
