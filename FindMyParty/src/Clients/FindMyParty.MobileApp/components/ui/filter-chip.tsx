import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, layout, radii, spacing, typography, weights } from '@/theme';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

const PRESS_SCALE = 0.96;
const PRESS_SPRING = { damping: 15, stiffness: 400, mass: 0.8 } as const;

/**
 * Filter chip with two visual states:
 *  - Inactive: glass blur surface + 1px hairline border, white label
 *  - Active: solid `colors.tint` fill, white label
 *
 * On press: light haptic + scale to 0.96; springs back on release.
 */
export function FilterChip({ label, selected, onPress }: Props) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    Haptics.selectionAsync();
    scale.value = withTiming(PRESS_SCALE, { duration: 100, easing: Easing.out(Easing.quad) });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, PRESS_SPRING);
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      // 32pt visual chip is below the 44pt HIG minimum — hitSlop expands the
      // effective tap target without changing the visual.
      hitSlop={layout.hitSlop}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Animated.View
        style={[
          styles.base,
          selected ? styles.active : styles.inactiveBorder,
          animatedStyle,
        ]}
      >
        {!selected ? (
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        ) : null}
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 32,
    paddingHorizontal: spacing.base,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  active: {
    backgroundColor: colors.tint,
  },
  inactiveBorder: {
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  label: {
    ...typography.subheadline,
    fontWeight: weights.medium,
    color: colors.label,
  },
});
