import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { springs, useReducedMotion } from '@/components/afterglow/motion';
import { Display } from '@/components/afterglow/text';
import { formatGlow } from '@/services/glow';
import { colors, typography } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** The mock's 84 pt ring with a 6 pt stroke, at phone scale. */
export const RING_SIZE = 114;
const STROKE = 8;
const RADIUS = (RING_SIZE - STROKE) / 2;
const LENGTH = 2 * Math.PI * RADIUS;
const CENTRE = RING_SIZE / 2;
const TRACK = 'rgba(255,255,255,0.1)';

type Props = {
  total: number;
  /** 0–1: the way from zero to the next level. */
  fill: number;
};

/**
 * The Glow total inside a lime ring that shows the way to the next level. It fills from empty on a
 * spring the first time it shows, and glides when the total changes. With Reduce Motion it is simply there.
 */
export function GlowRing({ total, fill }: Props) {
  const reduceMotion = useReducedMotion();
  const target = Math.min(1, Math.max(0, fill));
  const shown = useSharedValue(reduceMotion ? target : 0);

  useEffect(() => {
    shown.set(reduceMotion ? target : withSpring(target, springs.arrive));
  }, [shown, reduceMotion, target]);

  const animatedProps = useAnimatedProps(() => {
    // The spring overshoots; the ring must not run past full or below empty.
    const value = Math.min(1, Math.max(0, shown.get()));
    return {
      strokeDashoffset: LENGTH * (1 - value),
      // A zero-length dash with round ends would still draw a dot.
      strokeOpacity: value > 0.002 ? 1 : 0,
    };
  });

  return (
    <View style={styles.wrap} accessible accessibilityRole="text" accessibilityLabel={`${formatGlow(total)} Glow`}>
      {/* Turned a quarter back so the ring starts at twelve o'clock and runs clockwise. */}
      <Svg width={RING_SIZE} height={RING_SIZE} style={styles.turned}>
        <Circle cx={CENTRE} cy={CENTRE} r={RADIUS} stroke={TRACK} strokeWidth={STROKE} fill="none" />
        <AnimatedCircle
          cx={CENTRE}
          cy={CENTRE}
          r={RADIUS}
          stroke={colors.earned}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={[LENGTH, LENGTH]}
          animatedProps={animatedProps}
        />
      </Svg>
      <View style={styles.middle} pointerEvents="none">
        <Display size="md" style={styles.total} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {formatGlow(total)}
        </Display>
        <Text style={styles.unit}>Glow</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: RING_SIZE,
    height: RING_SIZE,
  },
  turned: {
    transform: [{ rotate: '-90deg' }],
  },
  middle: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: STROKE * 2,
  },
  total: {
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  unit: {
    ...typography.caption2,
    fontWeight: '600',
    color: colors.labelSecondary,
    marginTop: 2,
  },
});
