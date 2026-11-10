import { useEffect } from 'react';
import { StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { springs, useReducedMotion } from '@/components/afterglow/motion';
import type { Pass } from '@/types/api';
import { colors, layout, radii, spacing } from '@/theme';
import type { TicketEntry } from './format';
import { glide, leave } from './glide';
import { Ticket } from './ticket';

const DOT = 6;
const DOT_GAP = 6;
const MAX_TICKET_WIDTH = 440;

type Props = {
  entries: TicketEntry[];
  /** Width of the screen: each page is this wide, with the ticket inset by the screen margin. */
  pageWidth: number;
  /** The page on screen (already kept inside the list by the parent). */
  page: number;
  onPageChange: (page: number) => void;
  now: number;
  /** The screen is focused: the ticket on screen checks with the server for a door scan. */
  watching: boolean;
  guestName: string | null;
  tilt: SharedValue<number>;
  onScanned: (pass: Pass) => void;
};

/**
 * The upcoming passes, one ticket per page, swiped sideways. The tickets settle in once when the
 * pager first appears; that is the screen's one entrance.
 */
export function TicketPager({ entries, pageWidth, page, onPageChange, now, watching, guestName, tilt, onScanned }: Props) {
  const reduceMotion = useReducedMotion();
  const ticketWidth = Math.min(pageWidth - layout.screenMargin * 2, MAX_TICKET_WIDTH);

  const arrival = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (!reduceMotion) arrival.set(withSpring(1, springs.arrive));
  }, [arrival, reduceMotion]);

  const arrivalStyle = useAnimatedStyle(() => {
    const progress = arrival.get();
    return {
      opacity: Math.min(1, Math.max(0, progress * 2)),
      transform: [{ translateY: (1 - progress) * 28 }, { scale: 0.94 + 0.06 * progress }],
    };
  });

  // The position dot follows the finger, not the page that the swipe ends on.
  const scrollX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.set(event.contentOffset.x);
  });
  const lastDot = (entries.length - 1) * (DOT + DOT_GAP);
  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: Math.min(lastDot, Math.max(0, (scrollX.get() / pageWidth) * (DOT + DOT_GAP))) }],
  }));

  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    onPageChange(Math.max(0, Math.min(entries.length - 1, next)));
  };

  return (
    <Animated.View style={arrivalStyle}>
      <Animated.FlatList
        data={entries}
        keyExtractor={(entry) => entry.bookingId}
        horizontal
        pagingEnabled
        scrollEnabled={entries.length > 1}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onMomentumScrollEnd}
        getItemLayout={(_, index) => ({ length: pageWidth, offset: pageWidth * index, index })}
        itemLayoutAnimation={glide}
        renderItem={({ item, index }) => (
          <Animated.View exiting={leave} style={[styles.page, { width: pageWidth }]}>
            <Ticket
              bookingId={item.bookingId}
              booking={item.booking}
              width={ticketWidth}
              now={now}
              watch={watching && index === page}
              guestName={guestName}
              tilt={tilt}
              onScanned={onScanned}
            />
          </Animated.View>
        )}
      />

      {entries.length > 1 ? (
        <View style={styles.dots} accessible accessibilityRole="text" accessibilityLabel={`Pass ${page + 1} of ${entries.length}`}>
          <View style={styles.dotTrack}>
            {entries.map((entry) => (
              <View key={entry.bookingId} style={styles.dot} />
            ))}
            <Animated.View style={[styles.dot, styles.dotOn, dotStyle]} />
          </View>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  page: {
    alignItems: 'center',
  },
  dots: {
    alignItems: 'center',
    paddingTop: spacing.md,
  },
  dotTrack: {
    flexDirection: 'row',
    gap: DOT_GAP,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: radii.pill,
    backgroundColor: colors.labelQuaternary,
  },
  dotOn: {
    position: 'absolute',
    left: 0,
    top: 0,
    backgroundColor: colors.label,
  },
});
