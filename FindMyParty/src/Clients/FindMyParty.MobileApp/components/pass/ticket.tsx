import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import type { SharedValue } from 'react-native-reanimated';
import { Block } from '@/components/afterglow/block';
import { PressableScale } from '@/components/afterglow/motion';
import { Display } from '@/components/afterglow/text';
import { errorText } from '@/services/errorText';
import type { Booking, Pass } from '@/types/api';
import { colors, radii, spacing, typography } from '@/theme';
import { CodePanel, QR_SIZE } from './code-panel';
import { FoilSeal, FoilStripe } from './foil';
import { alpha, doorsLine, priceAtDoor } from './format';
import { usePassData } from './usePassData';

const INK_SOFT = alpha(colors.ink, 0.62);
const TEAR_INK = alpha(colors.ink, 0.3);
const NOTCH = 20;
const PADDING = spacing.lg;

type Props = {
  bookingId: string;
  /** Null when the bookings could not be loaded and only the saved pass is known. */
  booking: Booking | null;
  width: number;
  /** The screen's shared clock, in milliseconds. */
  now: number;
  /** True while this ticket is the one on screen: checks with the server for a door scan. */
  watch: boolean;
  guestName: string | null;
  tilt: SharedValue<number>;
  onScanned: (pass: Pass) => void;
};

/**
 * The pass as a paper ticket: the one pale object in a dark app. Party, foil band, the changing
 * door code, a tear line, and who it admits.
 */
export function Ticket({ bookingId, booking, width, now, watch, guestName, tilt, onScanned }: Props) {
  const { pass, isLoading, error, refetch } = usePassData(bookingId, watch, onScanned);

  const title = booking?.party?.title ?? pass?.partyTitle ?? 'Your pass';
  const venue = booking?.party?.venueName ?? pass?.venueName ?? null;
  const doors = doorsLine(booking?.party?.startsAt ?? pass?.startsAt, now);
  const ticketCount = booking?.ticketCount ?? pass?.ticketCount ?? 1;
  const totalPrice = booking?.totalPrice ?? pass?.totalPrice ?? 0;
  // Counts only go up, so the higher of the two answers is the newer one.
  const checkedIn = Math.min(ticketCount, Math.max(booking?.checkedInCount ?? 0, pass?.checkedInCount ?? 0));
  const outside = ticketCount - checkedIn;
  const cancelled = pass?.status === 'Cancelled';

  return (
    <View style={[styles.card, { width }]}>
      <View style={styles.head}>
        <View style={styles.headText}>
          {doors ? <Text style={styles.doors}>{doors}</Text> : null}
          <Display size="md" color={colors.ink} numberOfLines={2} accessibilityRole="header">
            {title}
          </Display>
          {venue ? <Text style={styles.venue}>{venue}</Text> : null}
        </View>
        <FoilSeal tilt={tilt} />
      </View>

      <FoilStripe tilt={tilt} width={width} />

      <View style={styles.body}>
        {checkedIn > 0 ? (
          <View style={styles.scanned}>
            <View style={styles.scannedRow}>
              <Block label="Scanned in" tone="earned" />
              <Text style={styles.scannedCount}>
                {checkedIn} of {ticketCount} in
              </Text>
            </View>
            {outside === 0 ? <Text style={styles.note}>Everyone on this pass is inside.</Text> : null}
          </View>
        ) : null}

        {cancelled ? (
          <Text style={styles.note}>This booking was cancelled.</Text>
        ) : outside > 0 ? (
          pass ? (
            <CodePanel bookingId={bookingId} secret={pass.secret} now={now} />
          ) : (
            <View style={styles.waiting}>
              {isLoading || !error ? (
                <ActivityIndicator color={colors.ink} accessibilityLabel="Loading your door code" />
              ) : (
                <>
                  <Text style={styles.note}>{errorText(error)}</Text>
                  <PressableScale
                    onPress={() => void refetch()}
                    style={styles.retry}
                    accessibilityRole="button"
                    accessibilityLabel="Try again"
                  >
                    <Text style={styles.retryLabel}>Try again</Text>
                  </PressableScale>
                </>
              )}
            </View>
          )
        ) : null}
      </View>

      <View style={styles.tear} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width={width - NOTCH - PADDING} height={2}>
          <Line x1={0} y1={1} x2={width - NOTCH - PADDING} y2={1} stroke={TEAR_INK} strokeWidth={1.5} strokeDasharray={[5, 4]} />
        </Svg>
        <View style={[styles.notch, styles.notchLeft]} />
        <View style={[styles.notch, styles.notchRight]} />
      </View>

      <View style={styles.footer}>
        {guestName ? (
          <Text style={styles.guest} numberOfLines={1}>
            {guestName}
          </Text>
        ) : null}
        <Text style={styles.admit}>
          <Text style={styles.admitCount}>Admit {ticketCount}</Text>, {priceAtDoor(totalPrice)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderRadius: radii.ticket,
    overflow: 'hidden',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: PADDING,
    paddingTop: PADDING,
    paddingBottom: spacing.base,
  },
  headText: {
    flex: 1,
    gap: spacing.xs,
  },
  doors: {
    ...typography.footnote,
    fontWeight: '700',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  venue: {
    ...typography.subheadline,
    color: INK_SOFT,
  },
  body: {
    alignItems: 'center',
    gap: spacing.base,
    paddingHorizontal: PADDING,
    paddingVertical: spacing.lg,
  },
  scanned: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  scannedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  scannedCount: {
    ...typography.headline,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  note: {
    ...typography.footnote,
    color: INK_SOFT,
    textAlign: 'center',
  },
  waiting: {
    minHeight: QR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  retry: {
    backgroundColor: colors.ink,
    borderRadius: radii.button,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  retryLabel: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.paper,
  },
  tear: {
    height: NOTCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Two bites out of the paper: circles in the screen's colour, half off each edge.
  notch: {
    position: 'absolute',
    top: 0,
    width: NOTCH,
    height: NOTCH,
    borderRadius: radii.pill,
    backgroundColor: colors.bg,
  },
  notchLeft: {
    left: -NOTCH / 2,
  },
  notchRight: {
    right: -NOTCH / 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    columnGap: spacing.md,
    rowGap: spacing.xs,
    paddingHorizontal: PADDING,
    paddingTop: spacing.md,
    paddingBottom: PADDING,
  },
  guest: {
    ...typography.subheadline,
    color: colors.ink,
    flexShrink: 1,
  },
  admit: {
    ...typography.subheadline,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  admitCount: {
    fontWeight: '700',
  },
});
