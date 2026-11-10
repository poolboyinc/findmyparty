import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { springs, useReducedMotion } from '@/components/afterglow/motion';
import { colors, radii, spacing, typography } from '@/theme';
import { SOUND_WEIGHTS } from './sound';

const BAR_HEIGHT = 8;
const BAR_GAP = spacing.sm;
/** The mock's bars fade from full violet to a third of it. */
const BAR_OPACITY = [1, 0.6, 0.3] as const;

/** Widths of the three bars for `count` picks, filling `width` in the 5 : 3 : 2 of the mock. */
function barWidths(width: number, count: number): number[] {
  const shown = Math.min(count, SOUND_WEIGHTS.length);
  const total = SOUND_WEIGHTS.slice(0, shown).reduce((sum, weight) => sum + weight, 0);
  const free = Math.max(0, width - BAR_GAP * Math.max(0, shown - 1));
  return SOUND_WEIGHTS.map((weight, index) => (index < shown && total > 0 ? (free * weight) / total : 0));
}

function Bar({ width, gap, opacity }: { width: number; gap: number; opacity: number }) {
  const reduceMotion = useReducedMotion();
  const size = useSharedValue(width);
  const lead = useSharedValue(gap);

  useEffect(() => {
    // Sizes do not move with Reduce Motion on; the bars simply take their new width.
    size.value = reduceMotion ? width : withSpring(width, springs.smooth);
    lead.value = reduceMotion ? gap : withSpring(gap, springs.smooth);
  }, [size, lead, width, gap, reduceMotion]);

  const style = useAnimatedStyle(() => ({ width: size.value, marginLeft: lead.value }));
  return <Animated.View style={[styles.bar, { opacity }, style]} />;
}

/**
 * "Your sound" under the pads (S-02): the first three picks as bars, 5 : 3 : 2, named underneath.
 * The bars grow and shrink on a spring as genres are picked; with nothing picked an empty track shows.
 */
export function SoundCard({ picks }: { picks: readonly string[] }) {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const top = picks.slice(0, SOUND_WEIGHTS.length);
  const widths = barWidths(width, top.length);

  const empty = useSharedValue(top.length === 0 ? 1 : 0);
  useEffect(() => {
    empty.value = withTiming(top.length === 0 ? 1 : 0, { duration: reduceMotion ? 120 : 220 });
  }, [empty, top.length, reduceMotion]);
  const trackStyle = useAnimatedStyle(() => ({ opacity: empty.value }));

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const summary = top.length > 0 ? `Your sound: ${top.join(', ')}` : 'Your sound: nothing picked yet';

  return (
    <View style={styles.card} accessible accessibilityRole="summary" accessibilityLabel={summary}>
      <Text style={styles.title}>Your sound</Text>
      <View style={styles.bars} onLayout={onLayout}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.track, trackStyle]} />
        {widths.map((barWidth, index) => (
          <Bar key={index} width={barWidth} gap={index > 0 && barWidth > 0 ? BAR_GAP : 0} opacity={BAR_OPACITY[index]} />
        ))}
      </View>
      <View style={styles.names}>
        {top.length > 0 ? (
          top.map((genre) => (
            <Text key={genre} style={styles.name} numberOfLines={1}>
              {genre}
            </Text>
          ))
        ) : (
          <Text style={styles.name}>Nothing yet</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingVertical: spacing.md + spacing.xxs,
    paddingHorizontal: spacing.base,
  },
  title: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.labelTertiary,
  },
  bars: {
    flexDirection: 'row',
    height: BAR_HEIGHT,
    marginTop: spacing.sm + spacing.xxs,
  },
  track: {
    borderRadius: BAR_HEIGHT / 2,
    backgroundColor: colors.surfaceElevated,
  },
  bar: {
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    backgroundColor: colors.tint,
  },
  names: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  name: {
    ...typography.footnote,
    color: colors.labelSecondary,
    flexShrink: 1,
  },
});
