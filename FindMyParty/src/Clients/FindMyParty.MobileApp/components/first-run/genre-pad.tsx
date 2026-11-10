import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { PressableScale, springs, useReducedMotion } from '@/components/afterglow/motion';
import { colors, spacing, typography } from '@/theme';

type Props = {
  genre: string;
  selected: boolean;
  /** Diameter in points. */
  size: number;
  onPress: () => void;
};

/**
 * One round pad on "What do you go out for?". Flat dark when off, filled with the action violet when
 * picked (S-02). Gives under the finger with a light tick; the fill comes in on a spring.
 */
export function GenrePad({ genre, selected, size, onPress }: Props) {
  const reduceMotion = useReducedMotion();
  const on = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    on.value = reduceMotion ? withTiming(selected ? 1 : 0, { duration: 120 }) : withSpring(selected ? 1 : 0, springs.snappy);
  }, [on, selected, reduceMotion]);

  const fillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [colors.surfaceElevated, colors.action]),
  }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(on.value, [0, 1], [colors.labelSecondary, colors.label]),
  }));

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.94}
      accessibilityRole="checkbox"
      accessibilityLabel={genre}
      accessibilityState={{ checked: selected }}
      style={{ width: size, height: size }}
    >
      <Animated.View style={[styles.pad, { borderRadius: size / 2 }, fillStyle]}>
        <Animated.Text style={[styles.label, labelStyle]} numberOfLines={1} adjustsFontSizeToFit>
          {genre}
        </Animated.Text>
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pad: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.subheadline,
    fontWeight: '600',
    paddingHorizontal: spacing.sm,
  },
});
