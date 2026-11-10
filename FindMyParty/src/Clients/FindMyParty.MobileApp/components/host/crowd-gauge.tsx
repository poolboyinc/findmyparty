import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { springs, useReducedMotion } from '@/components/afterglow/motion';
import { Display } from '@/components/afterglow/text';
import { colors, typography } from '@/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const WIDTH = 148;
const STROKE = 12;
const RADIUS = (WIDTH - STROKE) / 2;
/** Half a circle plus room for the round ends of the stroke. */
const HEIGHT = RADIUS + STROKE;
const BASELINE = RADIUS + STROKE / 2;
const LENGTH = Math.PI * RADIUS;
/** Left end, over the top, to the right end. */
const ARC = `M ${STROKE / 2} ${BASELINE} A ${RADIUS} ${RADIUS} 0 0 1 ${WIDTH - STROKE / 2} ${BASELINE}`;

type Props = {
  checkedIn: number;
  capacity: number;
};

/**
 * How full the venue is: a half-circle that fills in rose as guests are scanned in, with the exact
 * count inside it. Host screens only. The arc starts at its value and glides when the count changes.
 */
export function CrowdGauge({ checkedIn, capacity }: Props) {
  const reduceMotion = useReducedMotion();
  const target = capacity > 0 ? Math.min(1, Math.max(0, checkedIn / capacity)) : 0;
  const fill = useSharedValue(target);

  useEffect(() => {
    fill.set(reduceMotion ? target : withSpring(target, springs.smooth));
  }, [fill, reduceMotion, target]);

  const animatedProps = useAnimatedProps(() => {
    // The spring may overshoot a little; the dash must not.
    const shown = Math.min(1, Math.max(0, fill.get()));
    return {
      strokeDashoffset: LENGTH * (1 - shown),
      // A zero-length dash with round ends would still draw a dot.
      strokeOpacity: shown > 0.002 ? 1 : 0,
    };
  });

  return (
    <View style={styles.wrap} accessible accessibilityRole="text" accessibilityLabel={`${checkedIn} of ${capacity} inside`}>
      <View style={styles.arc}>
        <Svg width={WIDTH} height={HEIGHT}>
          <Path d={ARC} stroke={colors.fillSecondary} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
          <AnimatedPath
            d={ARC}
            stroke={colors.crowd}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={[LENGTH, LENGTH]}
            animatedProps={animatedProps}
          />
        </Svg>
        <View style={styles.count} pointerEvents="none">
          <Display size="lg" style={styles.figure} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {checkedIn}
          </Display>
        </View>
      </View>
      <Text style={styles.caption} numberOfLines={2}>
        of {capacity} inside
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: WIDTH,
    alignItems: 'center',
    gap: 2,
  },
  arc: {
    width: WIDTH,
    height: HEIGHT,
  },
  count: {
    position: 'absolute',
    left: STROKE * 2,
    right: STROKE * 2,
    bottom: 0,
    alignItems: 'center',
  },
  figure: {
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  caption: {
    ...typography.footnote,
    color: colors.labelSecondary,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
});
