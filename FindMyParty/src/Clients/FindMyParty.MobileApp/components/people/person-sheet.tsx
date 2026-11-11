import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { PressableScale } from '@/components/afterglow/motion';
import { Display } from '@/components/afterglow/text';
import { Icon } from '@/components/ui/icon';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useBlockUser, useRemoveFriend, useReportUser } from '@/hooks/queries';
import { errorText } from '@/services/errorText';
import { colors, layout, radii, spacing, typography } from '@/theme';
import type { ReportReason } from '@/types/api';
import { REPORT_REASONS, personLine } from './people';

/** The most a report note may say (the server keeps 500 characters). */
const NOTE_MAX = 500;

export type SheetPerson = { userId: string; displayName: string; handle: string; levelName: string; isFriend: boolean };

export type PersonSheetRef = {
  present: (person: SheetPerson) => void;
  dismiss: () => void;
};

type Step = 'menu' | 'report' | 'reported';

/**
 * A person's menu, opened from their row on Friends: Remove, Report (four reasons and a note), Block.
 * Remove and Block ask first; a report can be followed by a block.
 */
export const PersonSheet = forwardRef<PersonSheetRef>(function PersonSheet(_props, ref) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const [person, setPerson] = useState<SheetPerson | null>(null);
  const [step, setStep] = useState<Step>('menu');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');

  const removeFriend = useRemoveFriend();
  const blockUser = useBlockUser();
  const reportUser = useReportUser();

  const reset = useCallback(() => {
    setStep('menu');
    setReason(null);
    setNote('');
    removeFriend.reset();
    blockUser.reset();
    reportUser.reset();
  }, [removeFriend, blockUser, reportUser]);

  useImperativeHandle(
    ref,
    () => ({
      present: (next) => {
        reset();
        setPerson(next);
        sheetRef.current?.present();
      },
      dismiss: () => sheetRef.current?.dismiss(),
    }),
    [reset],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.5} pressBehavior="close" />
    ),
    [],
  );

  const done = () => sheetRef.current?.dismiss();

  const confirmRemove = () => {
    if (!person) return;
    Alert.alert(`Remove ${person.displayName}?`, 'You stop seeing each other on the map. You can add each other again later.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeFriend.mutate(person.userId, { onSuccess: done }),
      },
    ]);
  };

  const confirmBlock = () => {
    if (!person) return;
    Alert.alert(
      `Block ${person.displayName}?`,
      'You stop being friends, and neither of you can find or add the other. They are not told.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () =>
            blockUser.mutate(
              { userId: person.userId, block: true },
              {
                onSuccess: () => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  done();
                },
              },
            ),
        },
      ],
    );
  };

  const sendReport = () => {
    if (!person || !reason) return;
    const trimmed = note.trim();
    reportUser.mutate(
      { userId: person.userId, reason, note: trimmed ? trimmed : undefined },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setStep('reported');
        },
        onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
      },
    );
  };

  const failure = removeFriend.error ?? blockUser.error ?? reportUser.error;

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.background}
    >
      <BottomSheetView style={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}>
        {person ? (
          <>
            <View style={styles.heading}>
              <Display size="sm" accessibilityRole="header" numberOfLines={1}>
                {step === 'menu' ? person.displayName : step === 'report' ? `Report ${person.displayName}` : 'Thanks for telling us'}
              </Display>
              <Text style={styles.sub}>
                {step === 'menu'
                  ? personLine(person)
                  : step === 'report'
                    ? 'What is wrong? They are not told who reported them.'
                    : 'We look at every report. You can also block them, so they cannot find or add you.'}
              </Text>
            </View>

            {step === 'menu' ? (
              <View style={styles.card}>
                {person.isFriend ? (
                  <>
                    <MenuRow
                      label="Remove from friends"
                      sfSymbol="person.badge.minus"
                      ionicon="person-remove-outline"
                      busy={removeFriend.isPending}
                      onPress={confirmRemove}
                    />
                    <View style={styles.line} />
                  </>
                ) : null}
                <MenuRow label="Report" sfSymbol="flag" ionicon="flag-outline" onPress={() => setStep('report')} />
                <View style={styles.line} />
                <MenuRow
                  label="Block"
                  sfSymbol="hand.raised"
                  ionicon="hand-left-outline"
                  danger
                  busy={blockUser.isPending}
                  onPress={confirmBlock}
                />
              </View>
            ) : step === 'report' ? (
              <>
                <View style={styles.card} accessibilityRole="radiogroup">
                  {REPORT_REASONS.map((r, i) => (
                    <View key={r.reason}>
                      {i > 0 ? <View style={styles.line} /> : null}
                      <PressableScale
                        onPress={() => setReason(r.reason)}
                        scaleTo={0.98}
                        style={styles.menuRow}
                        accessibilityRole="radio"
                        accessibilityLabel={r.label}
                        accessibilityState={{ checked: reason === r.reason }}
                      >
                        <Text style={styles.menuLabel}>{r.label}</Text>
                        {reason === r.reason ? <Icon sfSymbol="checkmark" ionicon="checkmark" size={17} color={colors.tint} /> : null}
                      </PressableScale>
                    </View>
                  ))}
                </View>
                <BottomSheetTextInput
                  value={note}
                  onChangeText={(text) => setNote(text.slice(0, NOTE_MAX))}
                  placeholder="Anything we should know (optional)"
                  placeholderTextColor={colors.labelTertiary}
                  style={styles.note}
                  multiline
                  maxLength={NOTE_MAX}
                  accessibilityLabel="Note for the report, optional"
                />
                <PrimaryButton label="Send report" onPress={sendReport} loading={reportUser.isPending} disabled={!reason} />
              </>
            ) : (
              <View style={styles.buttons}>
                <PrimaryButton
                  variant="destructive"
                  label={`Block ${person.displayName}`}
                  onPress={confirmBlock}
                  loading={blockUser.isPending}
                />
                <PrimaryButton variant="secondary" label="Done" onPress={done} />
              </View>
            )}

            {failure ? (
              <Text style={styles.error} accessibilityLiveRegion="polite">
                {errorText(failure)}
              </Text>
            ) : null}
          </>
        ) : null}
      </BottomSheetView>
    </BottomSheetModal>
  );
});

type MenuRowProps = {
  label: string;
  sfSymbol: 'flag' | 'hand.raised' | 'person.badge.minus';
  ionicon: 'flag-outline' | 'hand-left-outline' | 'person-remove-outline';
  onPress: () => void;
  danger?: boolean;
  busy?: boolean;
};

function MenuRow({ label, sfSymbol, ionicon, onPress, danger, busy }: MenuRowProps) {
  const color = danger ? colors.danger : colors.label;
  return (
    <PressableScale
      onPress={onPress}
      disabled={busy}
      scaleTo={0.98}
      style={styles.menuRow}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: !!busy, disabled: !!busy }}
    >
      <Icon sfSymbol={sfSymbol} ionicon={ionicon} size={20} color={danger ? colors.danger : colors.labelSecondary} />
      <Text style={[styles.menuLabel, { color }]}>{label}</Text>
    </PressableScale>
  );
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
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  heading: {
    gap: spacing.xs,
  },
  sub: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingHorizontal: spacing.base,
  },
  line: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: layout.listItemHeightTall - 4,
  },
  menuLabel: {
    ...typography.body,
    color: colors.label,
    flex: 1,
  },
  note: {
    ...typography.body,
    color: colors.label,
    backgroundColor: colors.surface,
    borderRadius: radii.field,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    minHeight: 88,
    textAlignVertical: 'top',
  },
  buttons: {
    gap: spacing.sm,
  },
  error: {
    ...typography.subheadline,
    color: colors.danger,
  },
});
