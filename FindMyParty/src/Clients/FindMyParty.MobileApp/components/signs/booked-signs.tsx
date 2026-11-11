import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { Block } from '@/components/afterglow/block';
import { useReducedMotion } from '@/components/afterglow/motion';
import { useCancelSign } from '@/hooks/queries';
import { errorText } from '@/services/errorText';
import { colors, layout, radii, spacing, typography } from '@/theme';
import type { SignBooking } from '@/types/api';
import { bookingState, bookingTitle, canCancel, dateRange, euros } from './sign-format';
import { SignTile } from './sign-tile';

type Props = {
  /** The host's bookings, newest first. */
  bookings: readonly SignBooking[];
  /** Today as "2026-11-13", in the phone's time. */
  today: string;
};

/** Older bookings are not worth a long list here. */
const MAX_SHOWN = 10;

/**
 * "Booked" on Promote, under the booking flow (S-20): each sign the host booked, where it stands
 * ("In review", "Live", "Not approved" with the reviewer's note, "Ended"), and a way to take back one
 * that is not up yet. Then the line about the invoice: nothing is charged in the app.
 */
export function BookedSigns({ bookings, today }: Props) {
  const reduceMotion = useReducedMotion();
  const cancel = useCancelSign();
  const shown = bookings.filter((b) => b.status !== 'cancelled').slice(0, MAX_SHOWN);
  if (shown.length === 0) return null;

  const confirmCancel = (booking: SignBooking) => {
    Alert.alert('Cancel this sign?', `${bookingTitle(booking)}, ${dateRange(booking.startsOn, booking.endsOn)}. Nothing will be invoiced for it.`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel sign',
        style: 'destructive',
        onPress: () =>
          cancel.mutate(booking.id, {
            onError: (error) => Alert.alert('Not cancelled', errorText(error)),
          }),
      },
    ]);
  };

  return (
    <View>
      <Text style={styles.section} accessibilityRole="header">
        Booked
      </Text>
      <View style={styles.card}>
        {shown.map((booking, index) => {
          const state = bookingState(booking, today);
          const cancellable = canCancel(booking, today);
          const busy = cancel.isPending && cancel.variables === booking.id;
          return (
            <Animated.View
              key={booking.id}
              layout={reduceMotion ? undefined : LinearTransition.springify()}
              style={[styles.row, index > 0 && styles.divided]}
            >
              <SignTile
                text={booking.text}
                colorTop={booking.colorTop}
                colorBottom={booking.colorBottom}
                ink={booking.ink}
                artworkUrl={booking.artworkUrl}
                size={40}
              />
              <View style={styles.text}>
                <Text style={styles.title} numberOfLines={1}>
                  {bookingTitle(booking)}
                </Text>
                <Text style={styles.subtitle}>
                  {dateRange(booking.startsOn, booking.endsOn)}, {euros(booking.price)}
                </Text>
                {state.kind === 'rejected' && booking.reviewNote ? (
                  <Text style={styles.note}>{booking.reviewNote}</Text>
                ) : null}
                {cancellable ? (
                  <Pressable
                    onPress={() => confirmCancel(booking)}
                    disabled={busy}
                    hitSlop={layout.hitSlop}
                    accessibilityRole="button"
                    accessibilityLabel={`Cancel ${bookingTitle(booking)}`}
                    accessibilityState={{ disabled: busy, busy }}
                    style={styles.cancel}
                  >
                    <Text style={[styles.cancelLabel, busy && styles.cancelBusy]}>{busy ? 'Cancelling' : 'Cancel'}</Text>
                  </Pressable>
                ) : null}
              </View>
              <StateMark kind={state.kind} label={state.label} />
            </Animated.View>
          );
        })}
      </View>
      <Text style={styles.invoice}>We send the invoice by mail. Nothing is charged here.</Text>
    </View>
  );
}

function StateMark({ kind, label }: { kind: ReturnType<typeof bookingState>['kind']; label: string }) {
  if (kind === 'live') return <Block label={label} tone="paid" />;
  if (kind === 'review') return <Block label={label} tone="light" />;
  return <Text style={[styles.stateText, kind === 'rejected' && styles.stateRejected]}>{label}</Text>;
}

const styles = StyleSheet.create({
  section: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.labelSecondary,
    marginTop: spacing.base,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  divided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.label,
  },
  subtitle: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
  note: {
    ...typography.footnote,
    color: colors.label,
  },
  cancel: {
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  cancelLabel: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.tint,
  },
  cancelBusy: {
    color: colors.labelTertiary,
  },
  stateText: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.labelTertiary,
  },
  stateRejected: {
    color: colors.danger,
  },
  invoice: {
    ...typography.footnote,
    color: colors.labelSecondary,
    marginTop: spacing.sm,
  },
});
