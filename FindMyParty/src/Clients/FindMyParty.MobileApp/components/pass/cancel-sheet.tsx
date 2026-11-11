import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { PrimaryButton } from '@/components/ui/primary-button';
import { errorText } from '@/services/errorText';
import { colors, layout, radii, spacing, typography } from '@/theme';

export type CancelSheetRef = {
  present: () => void;
  dismiss: () => void;
};

type Props = {
  /** The party the booking is for, when known. */
  partyTitle: string | null;
  /** A pass someone gave you: it is given back to them instead of cancelled. */
  guest: boolean;
  /** Who gave it ("Vule"), for a guest pass. */
  guestOf: string | null;
  /** Guest links the booker handed out: they stop working too. */
  linksOut: number;
  cancelling: boolean;
  /** Whatever the cancel request threw, or null. Shown as one sentence inside the sheet. */
  error: unknown;
  onConfirm: () => void;
  onDismiss: () => void;
};

/**
 * Asks before cancelling a pass, or before a guest gives theirs back. The parent owns the request; the sheet stays open on a failure
 * so the reason shows in place and the guest can try again.
 */
export const CancelSheet = forwardRef<CancelSheetRef, Props>(function CancelSheet(
  { partyTitle, guest, guestOf, linksOut, cancelling, error, onConfirm, onDismiss },
  ref,
) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();

  useImperativeHandle(
    ref,
    () => ({
      present: () => sheetRef.current?.present(),
      dismiss: () => sheetRef.current?.dismiss(),
    }),
    [],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.5} pressBehavior="close" />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      enablePanDownToClose
      onDismiss={onDismiss}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.background}
    >
      <BottomSheetView style={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Text style={styles.title} accessibilityRole="header">
          {guest ? 'Give this pass back?' : 'Cancel this pass?'}
        </Text>
        <Text style={styles.body}>{body(partyTitle, guest, guestOf, linksOut)}</Text>
        {error ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {errorText(error)}
          </Text>
        ) : null}
        <View style={styles.buttons}>
          <PrimaryButton
            variant="destructive"
            label={guest ? 'Give it back' : 'Cancel pass'}
            onPress={onConfirm}
            loading={cancelling}
            accessibilityHint={guest ? 'Gives the spot back to who sent it' : 'Cancels this pass for good'}
          />
          <PrimaryButton
            variant="secondary"
            label="Keep it"
            onPress={() => sheetRef.current?.dismiss()}
            disabled={cancelling}
            accessibilityHint="Closes this question and keeps the pass"
          />
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

function body(partyTitle: string | null, guest: boolean, guestOf: string | null, linksOut: number): string {
  const party = partyTitle ? ` for ${partyTitle}` : '';
  if (guest) return `Your spot${party} goes back to ${guestOf ?? 'the friend who sent it'}.`;
  const links = linksOut > 0 ? (linksOut === 1 ? ' The guest link you sent stops working too.' : ' The guest links you sent stop working too.') : '';
  return `Your spots${party} go back to the party.${links} This cannot be undone.`;
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
  },
  handle: {
    backgroundColor: colors.labelTertiary,
    width: layout.sheetHandleWidth,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  title: {
    ...typography.title3,
    fontWeight: '700',
    color: colors.label,
  },
  body: {
    ...typography.callout,
    color: colors.labelSecondary,
  },
  error: {
    ...typography.subheadline,
    color: colors.danger,
  },
  buttons: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
});
