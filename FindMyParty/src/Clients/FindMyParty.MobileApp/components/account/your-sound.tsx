import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '@/theme';
import type { SoundShare } from '@/types/api';

/** Widest bar full violet, the next ones fainter, as in the mock (`--uv`, then 60% and 30%). */
const STRENGTH = [1, 0.6, 0.3] as const;
const BAR = 8;

/** `colors.quiet` at an opacity, for the fainter bars. */
function quietAt(opacity: number): string {
  const n = parseInt(colors.quiet.slice(1), 16);
  return `rgba(${(n >> 16) & 0xff},${(n >> 8) & 0xff},${n & 0xff},${opacity})`;
}

/** "Your sound" (`Me.sound`): the guest's top genres as up to three bars in proportion, with their percentages under them. */
export function YourSound({ shares }: { shares: SoundShare[] }) {
  const shown = shares.slice(0, 3);
  const spoken = shown.map((s) => `${s.genre} ${s.percent} percent`).join(', ');
  return (
    <View style={styles.card} accessible accessibilityRole="text" accessibilityLabel={`Your sound: ${spoken}`}>
      <View style={styles.bars}>
        {shown.map((s, i) => (
          <View key={s.genre} style={[styles.bar, { flex: Math.max(1, s.percent), backgroundColor: quietAt(STRENGTH[i] ?? 0.3) }]} />
        ))}
      </View>
      <View style={styles.labels}>
        {shown.map((s) => (
          <Text key={s.genre} style={styles.label} numberOfLines={1}>
            {s.genre} {s.percent}%
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
