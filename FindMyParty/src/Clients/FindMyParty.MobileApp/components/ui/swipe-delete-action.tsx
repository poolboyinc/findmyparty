import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import type { SymbolViewProps } from 'expo-symbols';
import type { Ionicons } from '@expo/vector-icons';
import { Icon } from '@/components/ui/icon';
import { colors, layout, spacing, typography, weights } from '@/theme';

/**
 * Shared swipe constants. Keep both callers (manage.tsx, my-bookings.tsx)
 * pinned to the same friction/threshold so the gesture feels identical
 * everywhere a destructive shelf is revealed.
 *
 * - `friction`: a touch more drag resistance than the default 2 so the panel
 *   tracks the finger with weight instead of skating.
 * - `rightThreshold`: ~⅓ of the 96pt panel — a confident flick snaps open
 *   without dragging halfway.
 * - `overshootFriction` paired with `overshootRight={false}` anchors the
 *   panel at its width (no rubber-band past the action).
 * - `activeOffsetX`: ±12pt before the pan claims the gesture, so a card swipe
 *   doesn't fight the tab navigator's edge-swipe gesture.
 */
export const SWIPE_DEFAULTS = {
  friction: 2.4,
  rightThreshold: 36,
  overshootFriction: 8,
  activeOffsetX: [-12, 12] as [number, number],
} as const;

type Props = {
  progress: SharedValue<number>;
  label: string;
  onPress: () => void;
  /** SF Symbol used on iOS. Default `trash.fill` for the host destructive
   *  shelf; consumer "My Tickets" passes `xmark.circle.fill` for Cancel. */
  sfSymbol?: SymbolViewProps['name'];
  /** Ionicons fallback used off-iOS. Default `trash` to match `sfSymbol`. */
  ionicon?: keyof typeof Ionicons.glyphMap;
};

/**
 * Destructive panel revealed when a card is swiped left. The red shelf stays
 * solid (anchored), while its icon + label settle in — a small scale/fade
 * driven by the swipeable's `progress` (0 closed → 1 open) — so the action
 * feels like it arrives rather than slides flatly into frame.
 *
 * Two-caller component:
 *   - Host: Delete / Cancel a party (manage.tsx)
 *   - Consumer: Cancel a booking (my-bookings.tsx)
 */
export function SwipeDeleteAction({
  progress,
  label,
  onPress,
  sfSymbol = 'trash.fill',
  ionicon = 'trash',
}: Props) {
  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.6, 1], [0, 0.7, 1], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(progress.value, [0, 1], [0.82, 1], Extrapolation.CLAMP) },
    ],
  }));
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.action}
    >
      <Animated.View style={[styles.content, contentStyle]}>
        <Icon sfSymbol={sfSymbol} ionicon={ionicon} size={22} color={colors.label} />
        <Text style={styles.label}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: {
    width: 96,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger,
    minHeight: layout.minTouchTarget,
  },
  content: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
  },
  label: {
    ...typography.caption1,
    fontWeight: weights.semibold,
    color: colors.label,
  },
});
