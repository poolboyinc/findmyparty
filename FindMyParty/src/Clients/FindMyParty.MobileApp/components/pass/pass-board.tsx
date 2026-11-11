import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import Animated from 'react-native-reanimated';
import { useQueryClient } from '@tanstack/react-query';
import { useReducedMotion } from '@/components/afterglow/motion';
import { Display } from '@/components/afterglow/text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { keys, useCancelBooking, useRevokeGuestPass } from '@/hooks/queries';
import type { Booking, Pass } from '@/types/api';
import { colors, layout, spacing, typography } from '@/theme';
import { CancelSheet, type CancelSheetRef } from './cancel-sheet';
import { Earlier } from './earlier';
import { requestFlare } from './flare-bus';
import { type TicketEntry } from './format';
import { glide, leave } from './glide';
import { GuestSheet, type GuestSheetRef } from './guest-sheet';
import { PassActions } from './pass-actions';
import { removePasses } from './passStore';
import { TicketPager } from './ticket-pager';
import { useFoilTilt } from './useFoilTilt';
import { useFullBrightness } from './useFullBrightness';

type Props = {
  /** Passes for parties still to come, soonest first. */
  entries: TicketEntry[];
  /** Bookings whose night is over or that were cancelled, latest first. */
  past: Booking[];
  /** The screen's shared clock, in milliseconds. */
  now: number;
  focused: boolean;
  /** A sentence above the tickets, e.g. that these are the copies saved on the phone. */
  notice?: string | null;
};

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
export function PassBoard({ entries, past, now, focused, notice }: Props) {
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const client = useQueryClient();
  const cancelBooking = useCancelBooking();
  const giveBack = useRevokeGuestPass();
  const sheetRef = useRef<CancelSheetRef>(null);
  const guestRef = useRef<GuestSheetRef>(null);

  const [pageState, setPage] = useState(0);
  const page = Math.max(0, Math.min(pageState, entries.length - 1));
  const current = entries[page]?.booking ?? null;

  const [target, setTarget] = useState<Booking | null>(null);
  const targetGuest = !!target?.guestPassId;
  const cancel = targetGuest ? giveBack : cancelBooking;

  const showing = focused && entries.length > 0;
  const tilt = useFoilTilt(showing);
  // The door's scanner reads the code best on a bright screen.
  useFullBrightness(showing);

  // A pass whose night is over or was cancelled has no use at the door: drop its saved copy.
  const pastIds = past.map((booking) => booking.id).join(',');
  useEffect(() => {
    if (pastIds) void removePasses(pastIds.split(','));
  }, [pastIds]);

  // The door let someone in while the ticket was on screen: the flare is drawn at the app's root, once per booking.
  const onScanned = useCallback(
    (pass: Pass) => {
      requestFlare({ bookingId: pass.bookingId, award: null, venueName: pass.venueName, noticedAt: Date.now(), tapped: false });
      void client.invalidateQueries({ queryKey: keys.bookings });
    },
    [client],
  );

  const askCancel = (booking: Booking) => {
    cancelBooking.reset();
    giveBack.reset();
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
            watching={focused}
            tilt={tilt}
            onScanned={onScanned}
          />
          {/* The foil follows the phone's tilt; with Reduce Motion it stays still, so there is nothing to say. */}
          {reduceMotion ? null : <Text style={styles.tiltHint}>Tilt your phone and the foil moves</Text>}
          <Animated.View layout={glide}>
            <PassActions booking={current} onSendToGuest={() => guestRef.current?.present()} onCancel={askCancel} />
          </Animated.View>
        </Animated.View>
      ) : (
        <NoPass title="No pass right now" />
      )}

      {past.length > 0 ? <Earlier bookings={past} /> : null}

      <CancelSheet
        ref={sheetRef}
        partyTitle={target?.party?.title ?? null}
        guest={targetGuest}
        guestOf={target?.guestOf ?? null}
        linksOut={target?.guestPasses.length ?? 0}
        cancelling={cancel.isPending}
        error={cancel.error}
        onConfirm={confirmCancel}
        onDismiss={() => setTarget(null)}
      />

      <GuestSheet ref={guestRef} booking={current} />
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
