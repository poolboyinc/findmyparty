import { useCallback, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/afterglow/motion';
import { Display } from '@/components/afterglow/text';
import { Icon } from '@/components/ui/icon';
import { colors, layout, radii, spacing, typography } from '@/theme';
import { useSheetPresence } from './card-motion';
import { distanceText, walkingTimeText, type WalkingRoute } from './directions';

type Props = {
  /** Shown while a walk is on and the City tab is in front. */
  open: boolean;
  venueName: string;
  /** Null while the position and the route are still being fetched. */
  route: WalkingRoute | null;
  /** What follows "To Monkey": ", doors open, your pass is ready" (`walkTail`). */
  tail: string;
  /** You hold a pass for the party there: "Show pass" is offered. */
  passReady: boolean;
  onEnd: () => void;
  onShowPass: () => void;
  onShareEta: () => void;
  /** Height of the sheet in points, so the camera can frame the route above it. */
  onHeight: (height: number) => void;
};

/** The grabber above the content, which the measured content height does not include. */
const HANDLE_HEIGHT = 24;

/**
 * S-06, the walk: a sheet at the bottom of the screen with how long and how far, where to, "End",
 * and under it "Show pass" (the walk ends at a door) and "Share ETA". It is not swiped away: "End"
 * ends the walk. Sizes are the mock's nav `.sheet` times about 1.37.
 */
export function RouteCard({ open, venueName, route, tail, passReady, onEnd, onShowPass, onShareEta, onHeight }: Props) {
  const sheet = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const { closed } = useSheetPresence(sheet, open);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => onHeight(event.nativeEvent.layout.height + HANDLE_HEIGHT),
    [onHeight],
  );

  return (
    <BottomSheetModal
      ref={sheet}
      enableDynamicSizing
      enablePanDownToClose={false}
      // On top of whatever is closing underneath (the venue sheet), without minimising it.
      stackBehavior="push"
      onDismiss={closed}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.background}
    >
      <BottomSheetView onLayout={handleLayout} style={[styles.content, { paddingBottom: insets.bottom + spacing.base }]}>
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
              {tail}
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
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
  },
  handle: {
    backgroundColor: colors.labelTertiary,
    width: layout.sheetHandleWidth,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: spacing.xs,
    gap: 14,
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
