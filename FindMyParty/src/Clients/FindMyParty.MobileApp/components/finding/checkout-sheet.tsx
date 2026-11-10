import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
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
import { useCreateBooking } from '@/hooks/queries';
import { ApiError } from '@/services/api';
import { MAX_GUESTS_PER_BOOKING, guestLimit, nextAttempt, type BookingAttempt } from '@/services/bookingAttempt';
import { errorText } from '@/services/errorText';
import { colors, layout, radii, spacing, typography } from '@/theme';
import type { PartyDetail } from '@/types/api';
import { dayText, joinParts, priceText, timeText } from './format';

export type CheckoutSheetRef = {
  present: () => void;
};

type Props = {
  party: PartyDetail;
  /** From `useNow()`: decides the day word in the summary line. */
  now: number;
};

/**
 * Taking a pass: how many guests, what it comes to at the door, confirm. Plain on purpose.
 * A failed booking stays in the sheet with its reason; a booking that went through lands on the Pass tab.
 */
export const CheckoutSheet = forwardRef<CheckoutSheetRef, Props>(function CheckoutSheet({ party, now }, ref) {
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);
  // Kept across retries so a booking that timed out but reached the server is not made twice.
  const attemptRef = useRef<BookingAttempt | null>(null);
  const [count, setCount] = useState(1);
  const { mutate, reset, isPending, error } = useCreateBooking();

  const limit = guestLimit(party.remainingCapacity);
  const guests = Math.max(1, Math.min(count, limit));
  const free = !(party.price > 0);
  const total = Math.round(guests * party.price * 100) / 100;
  const signedOut = error instanceof ApiError && error.kind === 'signed_out';

  useImperativeHandle(
    ref,
    () => ({
      present: () => {
        setCount(1);
        reset();
        sheetRef.current?.present();
      },
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
          // Back to the tabs that are already open, on the Pass tab. `replace` would put a second
          // copy of the tabs (and of the map) on top of the first.
          router.dismissTo('/(tabs)/pass');
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
          <Display size="sm" accessibilityRole="header">
            Your pass
          </Display>
          <Text style={styles.secondary}>
            {joinParts([party.title, party.venueName, dayText(party, now), timeText(party.startsAt)])}
          </Text>
        </View>

        <View style={[styles.block, styles.guests]}>
          <View style={styles.guestsText}>
            <Text style={styles.strong}>Guests</Text>
            <Text style={styles.secondary}>Up to {MAX_GUESTS_PER_BOOKING} on one pass</Text>
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

        <View style={styles.block}>
          {free ? (
            <View style={styles.sumRow}>
              <Text style={styles.strong}>Free entry</Text>
            </View>
          ) : (
            <>
              <View style={styles.sumRow}>
                <Text style={styles.body}>
                  Entry, {guests} × {priceText(party.price)}
                </Text>
                <Text style={styles.amount}>{priceText(total)}</Text>
              </View>
              <View style={styles.line} />
              <View style={styles.sumRow}>
                <Text style={styles.strong}>To pay at the door</Text>
                <Text style={[styles.amount, styles.amountTotal]}>{priceText(total)}</Text>
              </View>
            </>
          )}
        </View>

        <Text style={styles.secondary}>
          {free ? 'Nothing to pay.' : 'You pay at the door.'} Your pass appears in the Pass tab.
        </Text>

        {signedOut ? (
          <>
            <Text style={styles.strong}>Sign in to take a pass</Text>
            <PrimaryButton label="Sign in" onPress={signIn} accessibilityHint="Opens the sign in screen" />
          </>
        ) : (
          <>
            {error ? (
              <Text style={styles.error} accessibilityRole="alert">
                {errorText(error)}
              </Text>
            ) : null}
            <PrimaryButton
              label="Confirm pass"
              onPress={confirm}
              loading={isPending}
              disabled={limit < 1}
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
      <Icon sfSymbol={sfSymbol} ionicon={ionicon} size={18} color={colors.label} />
    </PressableScale>
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
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.sm,
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
  guests: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  guestsText: {
    flex: 1,
    gap: spacing.xxs,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  step: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: radii.chip,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDisabled: {
    opacity: 0.4,
  },
  count: {
    ...typography.title2,
    fontWeight: '700',
    color: colors.label,
    minWidth: 32,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  sumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.base,
  },
  line: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
  },
  body: {
    ...typography.body,
    color: colors.label,
    flexShrink: 1,
  },
  strong: {
    ...typography.headline,
    color: colors.label,
    flexShrink: 1,
  },
  amount: {
    ...typography.headline,
    color: colors.label,
    fontVariant: ['tabular-nums'],
  },
  amountTotal: {
    ...typography.title3,
    fontWeight: '700',
  },
  secondary: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
  error: {
    ...typography.subheadline,
    color: colors.danger,
  },
});
