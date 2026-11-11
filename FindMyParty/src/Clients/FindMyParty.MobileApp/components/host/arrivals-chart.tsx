import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { springs, useReducedMotion } from '@/components/afterglow/motion';
import { colors, radii, spacing, typography } from '@/theme';
import type { PartyLive } from '@/types/api';
import { clock } from './format';

const CHART_HEIGHT = 64;
/** A quarter-hour with nobody still shows as a sliver, so the row of bars reads as a timeline. */
const MIN_BAR = 3;

type Props = {
  /** Quarter-hours, oldest first. */
  arrivals: PartyLive['arrivals'];
  /** The party is on: the newest bar is "Now", in rose. An ended night shows its last quarter's time. */
  live: boolean;
};

/**
 * Guests let in per quarter-hour. While the party is on the newest bar is rose and labelled "Now";
 * heights are relative to the busiest quarter and glide when the numbers change.
 * Under the bars, as drawn: the first, third and fifth quarter's time, then "Now".
 */
export function ArrivalsChart({ arrivals, live }: Props) {
  if (arrivals.length === 0) return null;

  const busiest = Math.max(...arrivals.map((a) => a.count));
  const last = arrivals[arrivals.length - 1];
  const spoken = arrivals.map((a) => `${clock(a.from)}, ${a.count}`).join('. ');
  // Every other quarter up to the newest one, which gets its own label.
  const marks = arrivals.slice(0, -1).filter((_, i) => i % 2 === 0 && i <= arrivals.length - 3);

  return (
    <View style={styles.card} accessible accessibilityRole="text" accessibilityLabel={`Arrivals each quarter-hour. ${spoken}`}>
      <View style={styles.bars}>
        {arrivals.map((bucket, index) => (
          <Bar
            // The window slides every 15 minutes; a bar keeps its place, only its height changes.
            key={index}
            ratio={busiest > 0 ? bucket.count / busiest : 0}
            newest={live && index === arrivals.length - 1}
          />
        ))}
      </View>
      <View style={styles.times}>
        {marks.map((bucket) => (
          <Text key={bucket.from} style={styles.time}>
            {clock(bucket.from)}
          </Text>
        ))}
        <Text style={[styles.time, live && styles.timeNewest]}>{live ? 'Now' : clock(last.from)}</Text>
      </View>
    </View>
  );
}

function Bar({ ratio, newest }: { ratio: number; newest: boolean }) {
  const reduceMotion = useReducedMotion();
  const size = useSharedValue(ratio);

  useEffect(() => {
    size.set(reduceMotion ? ratio : withSpring(ratio, springs.smooth));
  }, [ratio, reduceMotion, size]);

  const style = useAnimatedStyle(() => ({
    height: MIN_BAR + (CHART_HEIGHT - MIN_BAR) * Math.min(1, Math.max(0, size.get())),
  }));

  return <Animated.View style={[styles.bar, newest ? styles.barNewest : styles.barEarlier, style]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.base,
    gap: spacing.sm,
  },
  bars: {
    height: CHART_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  bar: {
    flex: 1,
    borderTopLeftRadius: radii.xs,
    borderTopRightRadius: radii.xs,
  },
  // The mock's earlier quarters: the violet of an expected crowd, dimmed.
  barEarlier: {
    backgroundColor: colors.quiet,
    opacity: 0.3,
  },
  barNewest: {
    backgroundColor: colors.crowd,
  },
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  time: {
    ...typography.caption1,
    color: colors.labelSecondary,
    fontVariant: ['tabular-nums'],
  },
  timeNewest: {
    color: colors.crowd,
    fontWeight: '600',
  },
});
