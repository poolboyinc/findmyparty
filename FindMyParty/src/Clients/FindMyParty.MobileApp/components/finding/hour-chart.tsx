import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import type { VenueHour } from '@/types/api';
import { hourBars, hourChartLabel, type HourBar } from './hour-bars';

type Props = {
  hours: readonly VenueHour[];
  /** Height of the bars' area. Default 60. */
  height?: number;
};

/**
 * "Tonight by hour" (S-11): solid violet for what happened, rose for now, hatched for what this weekday usually
 * does later. Answers "should I go now or later". Hour labels under the bars, "Now" in rose.
 */
export function HourChart({ hours, height = CHART_HEIGHT }: Props) {
  const bars = hourBars(hours);
  if (bars.length === 0) return null;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={hourChartLabel(hours)}>
      <View style={[styles.bars, { height }]}>
        {bars.map((bar) => (
          <Bar key={bar.key} bar={bar} height={Math.max(2, Math.round(bar.height * height))} />
        ))}
      </View>
      <View style={styles.labels}>
        {bars.map((bar) => (
          <Text key={bar.key} style={[styles.label, bar.kind === 'now' && styles.labelNow]} numberOfLines={1}>
            {bar.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function Bar({ bar, height }: { bar: HourBar; height: number }) {
  if (bar.kind === 'usual') {
    // Hatched: thin lines from the bottom up, as the mock's repeating stripes.
    const stripes = Math.max(1, Math.floor(height / STRIPE_PERIOD));
    return (
      <View style={[styles.bar, styles.hatched, { height }]}>
        {Array.from({ length: stripes }, (_, i) => (
          <View key={i} style={styles.stripe} />
        ))}
      </View>
    );
  }
  return <View style={[styles.bar, { height }, bar.kind === 'now' ? styles.now : styles.past]} />;
}

const CHART_HEIGHT = 60;
const STRIPE = 2;
const STRIPE_PERIOD = 4;
const BAR_GAP = 4;

const styles = StyleSheet.create({
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: BAR_GAP,
  },
  bar: {
    flex: 1,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    overflow: 'hidden',
  },
  past: {
    // The mock's violet at 30%: what already happened, quieter than the rose of now.
    backgroundColor: colors.quiet,
    opacity: 0.3,
  },
  now: {
    backgroundColor: colors.crowd,
  },
  hatched: {
    justifyContent: 'flex-end',
    gap: STRIPE_PERIOD - STRIPE,
  },
  stripe: {
    height: STRIPE,
    backgroundColor: colors.labelQuaternary,
  },
  labels: {
    flexDirection: 'row',
    gap: BAR_GAP,
    marginTop: spacing.xs,
  },
  label: {
    ...typography.caption2,
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
    color: colors.labelTertiary,
    fontVariant: ['tabular-nums'],
  },
  labelNow: {
    color: colors.crowd,
  },
});
