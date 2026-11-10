import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { PressableScale } from '@/components/afterglow/motion';
import { Display } from '@/components/afterglow/text';
import { Icon } from '@/components/ui/icon';
import { colors, layout, radii, spacing, typography } from '@/theme';
import { CARD_ENTER, CARD_EXIT } from './card-motion';
import { distanceText, walkingTimeText, type WalkingRoute } from './directions';

type Props = {
  venueName: string;
  /** Null while the position and the route are still being fetched. */
  route: WalkingRoute | null;
  /** You hold a pass for a party there: the card says so and offers it. */
  passReady: boolean;
  onEnd: () => void;
  onShowPass: () => void;
  onShareEta: () => void;
};

/**
 * S-06, the walk: how long and how far, where to, "End", and under it "Show pass" (the walk ends
 * at a door) and "Share ETA". Sizes are the mock's `.sheet` on the nav screen times 1.35.
 */
export function RouteCard({ venueName, route, passReady, onEnd, onShowPass, onShareEta }: Props) {
  return (
    <Animated.View entering={CARD_ENTER} exiting={CARD_EXIT} style={styles.card}>
      <View style={styles.top}>
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
            {passReady ? ', your pass is ready' : ''}
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
      </View>

      {route ? (
        <View style={styles.actions}>
          {passReady ? (
            <PressableScale onPress={onShowPass} style={styles.action} accessibilityRole="button" accessibilityLabel="Show pass">
              <Icon sfSymbol="ticket" ionicon="ticket-outline" size={18} color={colors.label} />
              <Text style={styles.actionLabel}>Show pass</Text>
            </PressableScale>
          ) : null}
          <PressableScale
            onPress={onShareEta}
            style={styles.action}
            accessibilityRole="button"
            accessibilityLabel="Share when you will be there"
          >
            <Icon sfSymbol="square.and.arrow.up" ionicon="share-outline" size={18} color={colors.label} />
            <Text style={styles.actionLabel}>Share ETA</Text>
          </PressableScale>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.sheet,
    paddingHorizontal: 22,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
  },
  text: {
    flex: 1,
    gap: spacing.xs,
  },
  numbers: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    columnGap: spacing.sm,
  },
  time: {
    fontSize: 35,
    lineHeight: 37,
    fontVariant: ['tabular-nums'],
  },
  distance: {
    ...typography.footnote,
    color: colors.labelSecondary,
    fontVariant: ['tabular-nums'],
  },
  finding: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 37,
  },
  to: {
    ...typography.footnote,
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
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
  },
  endLabel: {
    ...typography.callout,
    fontWeight: '600',
    color: colors.crowd,
  },
  actions: {
    flexDirection: 'row',
    gap: 11,
  },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 46,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceElevated,
  },
  actionLabel: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.label,
  },
});
