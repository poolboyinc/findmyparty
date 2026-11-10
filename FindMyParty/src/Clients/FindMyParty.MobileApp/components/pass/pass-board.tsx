import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import Animated from 'react-native-reanimated';
import { useQueryClient } from '@tanstack/react-query';
import { useReducedMotion } from '@/components/afterglow/motion';
import { Display } from '@/components/afterglow/text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { keys, useCancelBooking } from '@/hooks/queries';
import type { Booking, Pass } from '@/types/api';
import { colors, layout, spacing, typography } from '@/theme';
import { CancelSheet, type CancelSheetRef } from './cancel-sheet';
import { Earlier } from './earlier';
import { clock, type TicketEntry } from './format';
import { glide, leave } from './glide';
import { PassActions } from './pass-actions';
import { removePasses } from './passStore';
import { ScanMoment } from './scan-moment';
import { TicketPager } from './ticket-pager';
import { useFoilTilt } from './useFoilTilt';

/** Pause between the success buzz and the heavy thud, so they land as two beats. */
const THUD_AFTER_MS = 260;

type Props = {
  /** Passes for parties still to come, soonest first. */
  entries: TicketEntry[];
  /** Bookings whose night is over or that were cancelled, latest first. */
  past: Booking[];
  /** The screen's shared clock, in milliseconds. */
  now: number;
  focused: boolean;
  guestName: string | null;
  /** The guest's Glow level ("Flame"), printed after the name on the ticket. */
  levelName: string | null;
  /** A sentence above the tickets, e.g. that these are the copies saved on the phone. */
  notice?: string | null;
};

type Moment = { time: string; venueName: string | null; bookingId: string };

/** "No pass" with the way to get one. Fills the screen when there is nothing else on it. */
export function NoPass({ title, fill = false }: { title: string; fill?: boolean }) {
  return (
    <View style={[styles.noPass, fill && styles.noPassFill]}>
      <Display size="sm" style={styles.centered}>
        {title}
      </Display>
      <Text style={styles.noPassBody}>Take a pass for a party and it shows up here.</Text>
      <View style={styles.noPassButton}>
        <PrimaryButton
          label="See what's on tonight"
          onPress={() => router.push('/(tabs)/parties')}
          accessibilityHint="Opens tonight's parties"
        />
      </View>
    </View>
  );
}

/** Everything on the Pass tab once there is something to show: the tickets, what to do with them, and earlier nights. */
export function PassBoard({ entries, past, now, focused, guestName, levelName, notice }: Props) {
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const client = useQueryClient();
  const cancel = useCancelBooking();
  const sheetRef = useRef<CancelSheetRef>(null);

  const [pageState, setPage] = useState(0);
  const page = Math.max(0, Math.min(pageState, entries.length - 1));
  const current = entries[page]?.booking ?? null;

  const [target, setTarget] = useState<Booking | null>(null);
  const [moment, setMoment] = useState<Moment | null>(null);

  const tilt = useFoilTilt(focused && entries.length > 0);

  // A pass whose night is over or was cancelled has no use at the door: drop its saved copy.
  const pastIds = past.map((booking) => booking.id).join(',');
  useEffect(() => {
    if (pastIds) void removePasses(pastIds.split(','));
  }, [pastIds]);

  const onScanned = useCallback(
    (pass: Pass) => {
      setMoment({ time: clock(new Date()), venueName: pass.venueName, bookingId: pass.bookingId });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        .then(() => {
          setTimeout(() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
          }, THUD_AFTER_MS);
        })
        .catch(() => {});
      // The booking's own count moved too.
      void client.invalidateQueries({ queryKey: keys.bookings });
    },
    [client],
  );

  const askCancel = (booking: Booking) => {
    cancel.reset();
    setTarget(booking);
    sheetRef.current?.present();
  };

  const confirmCancel = () => {
    if (!target || cancel.isPending) return;
    const bookingId = target.id;
    cancel.mutate(bookingId, {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        void removePasses([bookingId]);
        // Show it as cancelled at once; the refetch already under way brings the server's version.
        client.setQueryData<Booking[]>(keys.bookings, (bookings) =>
          bookings?.map((booking) => (booking.id === bookingId ? { ...booking, status: 'Cancelled' as const } : booking)),
        );
        sheetRef.current?.dismiss();
      },
      onError: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      },
    });
  };

  return (
    <View>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      {entries.length > 0 ? (
        <Animated.View exiting={leave}>
          <TicketPager
            entries={entries}
            pageWidth={width}
            page={page}
            onPageChange={setPage}
            now={now}
            watching={focused && !moment}
            guestName={guestName}
            levelName={levelName}
            tilt={tilt}
            onScanned={onScanned}
          />
          {/* The foil follows the phone's tilt; with Reduce Motion it stays still, so there is nothing to say. */}
          {reduceMotion ? null : <Text style={styles.tiltHint}>Tilt your phone and the foil moves</Text>}
          <Animated.View layout={glide}>
            <PassActions booking={current} onCancel={askCancel} />
          </Animated.View>
        </Animated.View>
      ) : (
        <NoPass title="No pass right now" />
      )}

      {past.length > 0 ? <Earlier bookings={past} /> : null}

      <CancelSheet
        ref={sheetRef}
        partyTitle={target?.party?.title ?? null}
        cancelling={cancel.isPending}
        error={cancel.error}
        onConfirm={confirmCancel}
        onDismiss={() => setTarget(null)}
      />

      {moment ? <ScanMoment time={moment.time} venueName={moment.venueName} bookingId={moment.bookingId} onDone={() => setMoment(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tiltHint: {
    ...typography.footnote,
    color: colors.labelTertiary,
    textAlign: 'center',
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.base,
  },
  notice: {
    ...typography.footnote,
    color: colors.labelSecondary,
    paddingHorizontal: layout.screenMargin,
    paddingBottom: spacing.md,
  },
  noPass: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: layout.screenMargin,
    paddingVertical: spacing.xxl,
  },
  noPassFill: {
    flex: 1,
    justifyContent: 'center',
  },
  centered: {
    textAlign: 'center',
  },
  noPassBody: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    textAlign: 'center',
  },
  noPassButton: {
    marginTop: spacing.md,
  },
});
