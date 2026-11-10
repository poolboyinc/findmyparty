import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { PressableScale } from '@/components/afterglow/motion';
import { Display } from '@/components/afterglow/text';
import { colors, radii, spacing, typography } from '@/theme';
import { CARD_ENTER, CARD_EXIT } from './card-motion';
import { distanceText, walkingTimeText, type WalkingRoute } from './directions';

type Props = {
  venueName: string;
  /** Null while the position and the route are still being fetched. */
  route: WalkingRoute | null;
  onEnd: () => void;
};

/**
 * The walk in two numbers: how long and how far, from the Directions answer, and where to.
 * "End" clears the line from the map. No turn-by-turn in this version.
 */
export function RouteCard({ venueName, route, onEnd }: Props) {
  return (
    <Animated.View entering={CARD_ENTER} exiting={CARD_EXIT} style={styles.card}>
      <View style={styles.text}>
        {route ? (
          <View style={styles.numbers}>
            <Display size="lg" color={colors.you} style={styles.time}>
              {walkingTimeText(route.seconds)}
            </Display>
            <Text style={styles.distance}>{`${distanceText(route.metres)}, walking`}</Text>
          </View>
        ) : (
          <View style={styles.finding}>
            <ActivityIndicator color={colors.you} />
            <Text style={styles.distance}>Finding the way</Text>
          </View>
        )}
        <Text style={styles.to} numberOfLines={2}>
          To <Text style={styles.venue}>{venueName}</Text>
        </Text>
      </View>

      <PressableScale
        onPress={onEnd}
        style={styles.end}
        accessibilityRole="button"
        accessibilityLabel={route ? 'End route' : 'Cancel route'}
      >
        <Text style={styles.endLabel}>{route ? 'End' : 'Cancel'}</Text>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    backgroundColor: colors.surface,
    borderRadius: radii.sheet,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.base,
  },
  text: {
    flex: 1,
    gap: spacing.xs,
  },
  numbers: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    columnGap: spacing.md,
  },
  time: {
    fontVariant: ['tabular-nums'],
  },
  distance: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    fontVariant: ['tabular-nums'],
  },
  finding: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 38,
  },
  to: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
  venue: {
    fontWeight: '600',
    color: colors.label,
  },
  end: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.button,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  endLabel: {
    ...typography.headline,
    color: colors.label,
  },
});
