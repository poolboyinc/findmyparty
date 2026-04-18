import React, { useEffect } from 'react';
import { type ViewStyle, type StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';

type Props = {
  size: number;
  color: string;
  /** Starting translation (relative to parent top-left). */
  from?: { x: number; y: number };
  /** End translation. Omit for static. */
  to?: { x: number; y: number };
  /** One-way drift duration in ms (drifts from→to, then to→from). */
  duration?: number;
  /** Delay before drift starts. */
  delay?: number;
  /** Overall opacity of the orb. */
  opacity?: number;
  /** Slow breathing scale loop. */
  breathe?: boolean;
  /** Breathing amplitude — 1.0 is min, this is max. */
  breatheTo?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * GradientOrb — an animated radial-ish gradient blob that drifts and breathes.
 * Pointer events pass through. Use behind content for atmospheric depth.
 *
 * Implementation note: RN's LinearGradient can't do true radial gradients,
 * so we simulate one by fading a solid color into transparent along both
 * axes with start={0.5,0.5}.
 */
export function GradientOrb({
  size,
  color,
  from = { x: 0, y: 0 },
  to,
  duration = 14000,
  delay = 0,
  opacity = 0.55,
  breathe = true,
  breatheTo = 1.06,
  style,
}: Props) {
  const t = useSharedValue(0);
  const b = useSharedValue(0);

  useEffect(() => {
    if (to) {
      t.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration, easing: Easing.bezier(0.42, 0, 0.58, 1) }),
            withTiming(0, { duration, easing: Easing.bezier(0.42, 0, 0.58, 1) }),
          ),
          -1,
          false,
        ),
      );
    }
    if (breathe) {
      b.value = withRepeat(
        withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
    }
  }, [to, duration, delay, breathe, t, b]);

  const animStyle = useAnimatedStyle(() => {
    const x = to ? from.x + (to.x - from.x) * t.value : from.x;
    const y = to ? from.y + (to.y - from.y) * t.value : from.y;
    const scale = breathe ? 1 + (breatheTo - 1) * b.value : 1;
    return { transform: [{ translateX: x }, { translateY: y }, { scale }] };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity,
        },
        style,
        animStyle,
      ]}
    >
      <LinearGradient
        colors={[color, 'transparent']}
        start={{ x: 0.5, y: 0.5 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1, borderRadius: size / 2 }}
      />
    </Animated.View>
  );
}
