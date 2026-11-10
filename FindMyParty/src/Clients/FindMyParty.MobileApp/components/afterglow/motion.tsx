import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';

/**
 * Motion rules for Afterglow.
 * - Things move on springs, and follow the finger where there is one. No fade-and-slide-up on every element.
 * - One entrance per screen at most: the main object arrives, the rest is simply there.
 * - Haptics mark real events (a tap that does something, a booking made, a scan), not decoration.
 * - With Reduce Motion on, positions and sizes do not animate; a quick opacity change is fine.
 */
export const springs = {
  /** Small things answering a touch: buttons, chips, tab icons. */
  snappy: { damping: 18, stiffness: 320, mass: 0.6 },
  /** Things changing place or size: sheets settling, cards expanding. */
  smooth: { damping: 22, stiffness: 190, mass: 0.9 },
  /** A big arrival, once: the pass, the "You're in" beam. */
  arrive: { damping: 14, stiffness: 120, mass: 1 },
} as const;

export { useReducedMotion };

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressableScaleProps = Omit<PressableProps, 'style'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** How far it presses in. Default 0.97. */
  scaleTo?: number;
  /** A light tick when pressed. Default true. Turn off when the handler gives its own haptic. */
  haptic?: boolean;
};

/** A pressable that gives under the finger on a spring. Use for anything tappable that is not a text link. */
export function PressableScale({ children, style, scaleTo = 0.97, haptic = true, onPressIn, onPressOut, disabled, ...rest }: PressableScaleProps) {
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reduceMotion ? 1 : 1 - (1 - scaleTo) * pressed.value }],
    opacity: reduceMotion ? 1 - 0.25 * pressed.value : 1,
  }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        pressed.value = withSpring(1, springs.snappy);
        if (haptic && !disabled) Haptics.selectionAsync();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.value = withSpring(0, springs.snappy);
        onPressOut?.(e);
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
