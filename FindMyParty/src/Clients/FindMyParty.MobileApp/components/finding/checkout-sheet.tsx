import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { PressableScale } from '@/components/afterglow/motion';
import { Display } from '@/components/afterglow/text';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { routes } from '@/constants/routes';
import { useBookingQuote, useCreateBooking } from '@/hooks/queries';
import { ApiError } from '@/services/api';
import { MAX_GUESTS_PER_BOOKING, guestLimit, nextAttempt, type BookingAttempt } from '@/services/bookingAttempt';
import { errorText } from '@/services/errorText';
import { askForPush } from '@/services/push';
import { colors, layout, radii, spacing, typography } from '@/theme';
import type { BookingQuote, PartyDetail } from '@/types/api';
import { checkoutLines, estimateHeldUntil } from './checkout';
import { dateText, isOver, joinParts, timeText } from './format';
import { useNow } from './use-now';

export type CheckoutSheetRef = {
  present: () => void;
  dismiss: () => void;
};

type Props = {
  party: PartyDetail;
  /** From the screen's `useNow()`. Without it the sheet keeps its own clock. */
  now?: number;
};

function isSignedOut(error: unknown): boolean {
  return error instanceof ApiError && error.kind === 'signed_out';
}

/**
 * Taking a pass (S-13): how many guests, what the server says it comes to at the door (with the guest's perk),
 * how to pay (at the door; "Pay now" is drawn greyed out and cannot be chosen), until when the spot is held,
 * confirm. Plain on purpose. A failed booking stays in the sheet with its reason; one that went through lands
 * on the Pass tab. Mounted by the party page and by the map's venue sheet.
 */
export const CheckoutSheet = forwardRef<CheckoutSheetRef, Props>(function CheckoutSheet({ party, now: screenNow }, ref) {
  const insets = useSafeAreaInsets();
  const ownNow = useNow();
  const now = screenNow ?? ownNow;
  const sheetRef = useRef<BottomSheetModal>(null);
  // Kept across retries so a booking that timed out but reached the server is not made twice.
  const attemptRef = useRef<BookingAttempt | null>(null);
  // The last quote, so the perk row keeps its place while the next guest count is asked for.
  const [lastQuoteAny, setLastQuote] = useState<BookingQuote | null>(null);
  const [count, setCount] = useState(1);
  const { mutate, reset, isPending, error } = useCreateBooking();

  const spots = guestLimit(party.remainingCapacity);
  const bookable = spots >= 1 && !isOver(party, now);
  const lastQuote = lastQuoteAny?.partyId === party.id ? lastQuoteAny : null;
  const limit = Math.min(spots, lastQuote?.maxGuests ?? spots);
  const guests = Math.max(1, Math.min(count, Math.max(1, limit)));

  // Asked for as soon as the page is open, so the sheet shows the server's numbers when it comes up.
  const quote = useBookingQuote(bookable ? party.id : undefined, guests);
  useEffect(() => {
    if (quote.data) setLastQuote(quote.data);
  }, [quote.data]);
  const loadingQuote = bookable && !quote.data && !quote.error;
  const quoteFailed = !quote.data && !!quote.error;

  const lines = checkoutLines(quote.data, {
    guests,
    price: party.price,
    perkTitle: lastQuote?.perk?.title ?? (lastQuote ? null : party.perk?.title ?? null),
  });
  const heldUntil = quote.data ? Date.parse(quote.data.heldUntil) : estimateHeldUntil(party, now);
  const heldText = heldUntil === null || Number.isNaN(heldUntil) ? '' : timeText(heldUntil);
  const signedOut = isSignedOut(error) || isSignedOut(quote.error);
  const shownError = error ?? (quoteFailed ? quote.error : null);

  useImperativeHandle(
    ref,
    () => ({
      present: () => {
        setCount(1);
        reset();
        sheetRef.current?.present();
      },
      dismiss: () => sheetRef.current?.dismiss(),
    }),
    [reset],
  );

  const changeGuests = (by: number) => {
    const next = Math.max(1, Math.min(guests + by, limit));
    // A tick only when the number really changes; silence at either end is the wall.
    if (next === guests) return;
    Haptics.selectionAsync();
    if (error) reset();
    setCount(next);
  };

  const confirm = () => {
    if (isPending) return;
    const attempt = nextAttempt(attemptRef.current, party.id, guests, uuidv4);
    attemptRef.current = attempt;
    mutate(
      { partyId: party.id, ticketCount: guests, idempotencyKey: attempt.key },
      {
        onSuccess: () => {
          attemptRef.current = null;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          sheetRef.current?.dismiss();
          // A pass taken is the moment a push means something ("your spot is held until 00:30"). Asks once.
          void askForPush();
          // Back to the tabs that are already open, on the Pass tab. `replace` would put a second
          // copy of the tabs (and of the map) on top of the first.
          router.dismissTo(routes.pass);
        },
        onError: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        },
      },
    );
  };

  const signIn = () => {
    sheetRef.current?.dismiss();
    router.replace('/onboarding');
  };

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.6} pressBehavior="close" />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.background}
    >
      <BottomSheetView style={[styles.content, { paddingBottom: insets.bottom + spacing.base }]}>
        <View style={styles.heading}>
          <Display size="md" accessibilityRole="header">
            Your pass
          </Display>
          <Text style={styles.secondary}>
            {joinParts([party.title, party.venueName, dateText(party.startsAt), timeText(party.startsAt)])}
          </Text>
        </View>

        <View style={[styles.block, styles.guests]}>
          <View style={styles.guestsText}>
            <Text style={styles.guestsLabel}>Guests</Text>
            <Text style={styles.small}>Up to {MAX_GUESTS_PER_BOOKING} on one pass</Text>
          </View>
          <View style={styles.stepper}>
            <StepButton
              sfSymbol="minus"
              ionicon="remove"
              label="One guest fewer"
              disabled={isPending || guests <= 1}
              onPress={() => changeGuests(-1)}
            />
            <Text
              style={styles.count}
              accessibilityLabel={guests === 1 ? '1 guest' : `${guests} guests`}
              accessibilityLiveRegion="polite"
            >
              {guests}
            </Text>
            <StepButton
              sfSymbol="plus"
              ionicon="add"
              label="One guest more"
              disabled={isPending || guests >= limit}
              onPress={() => changeGuests(1)}
            />
          </View>
        </View>

        {/* While the quote is on its way the rows show the party's own price, dimmed, so nothing jumps. */}
        <View style={styles.block} accessibilityState={{ busy: loadingQuote }}>
          <View style={loadingQuote && styles.waiting}>
            {lines.free && !lines.perk ? (
              <View style={styles.sumRow}>
                <Text style={styles.totalLabel}>Free entry</Text>
              </View>
            ) : (
              <>
                <View style={styles.sumRow}>
                  <Text style={styles.body}>{lines.entry}</Text>
                  <Text style={styles.amount}>{lines.subtotal}</Text>
                </View>
                {lines.perk ? (
                  <>
                    <View style={styles.line} />
                    <View style={styles.sumRow} accessible accessibilityLabel={joinParts([lines.perk.title, lines.perk.amount])}>
                      <Icon sfSymbol="bolt" ionicon="flash-outline" size={19} color={colors.earned} />
                      <Text style={[styles.body, styles.perkText]}>{lines.perk.title}</Text>
                      <Text style={[styles.amount, styles.perkAmount]}>{lines.perk.amount}</Text>
                    </View>
                  </>
                ) : null}
                <View style={styles.line} />
                <View style={styles.sumRow}>
                  <Text style={styles.totalLabel}>To pay at the door</Text>
                  <Text style={styles.totalAmount}>{lines.total}</Text>
                </View>
              </>
            )}
          </View>
        </View>

        <View style={styles.block} accessibilityRole="radiogroup" accessibilityLabel="How to pay">
          <View style={styles.payRow} accessible accessibilityRole="radio" accessibilityState={{ checked: true }} accessibilityLabel="Pay at the door">
            <View style={styles.radioOn} />
            <Text style={styles.payOn}>Pay at the door</Text>
          </View>
          <View style={styles.line} />
          {/* Drawn as on the mock and inert: there is no payment in the app yet. */}
          <View
            style={styles.payRow}
            accessible
            accessibilityRole="radio"
            accessibilityState={{ checked: false, disabled: true }}
            accessibilityLabel="Pay now, Apple Pay. Later."
          >
            <View style={styles.radioOff} />
            <Text style={styles.payOff}>Pay now, Apple Pay</Text>
            <Text style={styles.later}>Later</Text>
          </View>
        </View>

        {heldText ? (
          <Text style={styles.small}>
            Your spot is held until <Text style={styles.held}>{heldText}</Text>. If you are not scanned in by then, it goes
            back to the door.
          </Text>
        ) : null}

        {signedOut ? (
          <>
            <Text style={styles.strong}>Sign in to take a pass</Text>
            <PrimaryButton label="Sign in" onPress={signIn} accessibilityHint="Opens the sign in screen" />
          </>
        ) : (
          <>
            {shownError ? (
              <Text style={styles.error} accessibilityRole="alert">
                {errorText(shownError)}
                {quoteFailed && !error ? (
                  <Text style={styles.retry} onPress={() => quote.refetch()} accessibilityRole="button">
                    {' '}
                    Try again
                  </Text>
                ) : null}
              </Text>
            ) : null}
            <PrimaryButton
              label="Confirm pass"
              onPress={confirm}
              loading={isPending}
              disabled={!bookable || quoteFailed}
              accessibilityHint="Takes the pass. You pay at the door."
            />
          </>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
});

type StepButtonProps = {
  sfSymbol: 'minus' | 'plus';
  ionicon: 'remove' | 'add';
  label: string;
  disabled: boolean;
  onPress: () => void;
};

function StepButton({ sfSymbol, ionicon, label, disabled, onPress }: StepButtonProps) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      // The handler ticks only when the count changes.
      haptic={false}
      scaleTo={0.92}
      style={[styles.step, disabled && styles.stepDisabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <Icon sfSymbol={sfSymbol} ionicon={ionicon} size={16} color={colors.label} />
    </PressableScale>
  );
}

const STEP = 40;
const RADIO = 20;
const SUM_ROW = 48;

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
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.base,
    gap: spacing.base,
  },
  heading: {
    gap: spacing.xs,
  },
  block: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.card,
    paddingHorizontal: spacing.base,
  },
  waiting: {
    opacity: 0.5,
  },
  guests: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md + 2,
  },
  guestsText: {
    flex: 1,
    gap: spacing.xxs,
  },
  guestsLabel: {
    ...typography.callout,
    fontWeight: '700',
    color: colors.label,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  step: {
    width: STEP,
    height: STEP,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDisabled: {
    opacity: 0.4,
  },
  count: {
    ...typography.title3,
    fontWeight: '700',
    color: colors.label,
    minWidth: 24,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  sumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: SUM_ROW,
    paddingVertical: spacing.md,
  },
  line: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.hairline,
  },
  body: {
    ...typography.subheadline,
    color: colors.label,
    flex: 1,
  },
  perkText: {
    color: colors.earned,
  },
  strong: {
    ...typography.headline,
    color: colors.label,
    flexShrink: 1,
  },
  amount: {
    ...typography.subheadline,
    fontWeight: '700',
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
  perkAmount: {
    color: colors.earned,
  },
  totalLabel: {
    ...typography.headline,
    fontWeight: '700',
    color: colors.label,
    flexShrink: 1,
  },
  totalAmount: {
    ...typography.title3,
    fontWeight: '700',
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: SUM_ROW,
    paddingVertical: spacing.md,
  },
  radioOn: {
    width: RADIO,
    height: RADIO,
    borderRadius: RADIO / 2,
    borderWidth: 6,
    borderColor: colors.tint,
  },
  radioOff: {
    width: RADIO,
    height: RADIO,
    borderRadius: RADIO / 2,
    borderWidth: 1.5,
    borderColor: colors.labelTertiary,
  },
  payOn: {
    ...typography.subheadline,
    fontWeight: '700',
    color: colors.label,
    flex: 1,
  },
  payOff: {
    ...typography.subheadline,
    color: colors.labelTertiary,
    flex: 1,
  },
  later: {
    ...typography.caption1,
    fontWeight: '600',
    color: colors.labelTertiary,
  },
  held: {
    fontWeight: '700',
    color: colors.label,
  },
  secondary: {
    ...typography.subheadline,
    fontSize: 14,
    color: colors.labelSecondary,
  },
  small: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
  error: {
    ...typography.subheadline,
    color: colors.danger,
  },
  retry: {
    fontWeight: '600',
    color: colors.tint,
  },
});

