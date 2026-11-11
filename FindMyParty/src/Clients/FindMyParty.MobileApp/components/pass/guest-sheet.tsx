import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { Alert, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useCreateGuestPass, useRevokeGuestPass } from '@/hooks/queries';
import { errorText } from '@/services/errorText';
import type { Booking, GuestPass } from '@/types/api';
import { colors, layout, radii, spacing, typography } from '@/theme';
import { canGiveSpot, guestPassState } from './format';
import { glide } from './glide';

export type GuestSheetRef = {
  present: () => void;
  dismiss: () => void;
};

type Props = {
  /** The booking whose spots are being handed out. Its `guestPasses` are the rows. */
  booking: Booking | null;
};

/** Opens the share sheet with a guest link. Closing it without sending is not an error. */
async function shareLink(url: string, partyTitle: string | null): Promise<void> {
  const text = partyTitle ? `A spot on my pass for ${partyTitle}` : 'A spot on my pass';
  try {
    await Share.share(Platform.OS === 'ios' ? { message: text, url } : { message: `${text} ${url}` });
  } catch {
    // Nothing was shared; the link stays in the list.
  }
}

/**
 * "Send to a guest" (S-14): each link is one spot on the pass, with its own door code and its own Glow.
 * Lists the links already made with where each stands, to share again or take back, and makes a new one
 * while a spot is free.
 */
export const GuestSheet = forwardRef<GuestSheetRef, Props>(function GuestSheet({ booking }, ref) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const create = useCreateGuestPass();
  const revoke = useRevokeGuestPass();

  useImperativeHandle(
    ref,
    () => ({
      present: () => {
        create.reset();
        revoke.reset();
        sheetRef.current?.present();
      },
      dismiss: () => sheetRef.current?.dismiss(),
    }),
    [create, revoke],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.5} pressBehavior="close" />
    ),
    [],
  );

  const partyTitle = booking?.party?.title ?? null;
  const links = booking?.guestPasses ?? [];
  const canMake = !!booking && canGiveSpot(booking);
  const error = create.error ?? revoke.error;

  const makeLink = () => {
    if (!booking || create.isPending) return;
    revoke.reset();
    create.mutate(booking.id, {
      onSuccess: (pass) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        void shareLink(pass.url, partyTitle);
      },
      onError: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      },
    });
  };

  const takeBack = (pass: GuestPass) => {
    const go = () => {
      create.reset();
      revoke.mutate(pass.id, {
        onSuccess: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
        onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
      });
    };
    // Someone already holds this one: say so before their pass stops working.
    if (pass.status === 'claimed') {
      const name = pass.guestName?.trim() || 'Your guest';
      Alert.alert(`Take the pass back from ${name}?`, 'Their code stops working and the spot comes back to your pass.', [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Take back', style: 'destructive', onPress: go },
      ]);
    } else {
      go();
    }
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.background}
    >
      <BottomSheetView style={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}>
        <Text style={styles.title} accessibilityRole="header">
          Send to a guest
        </Text>
        <Text style={styles.body}>
          Each link is good for one spot on your pass. Your guest gets their own door code and earns their own Glow.
        </Text>

        {links.length > 0 ? (
          <View style={styles.list}>
            {links.map((pass, index) => (
              <Animated.View key={pass.id} layout={glide} style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {guestPassState(pass)}
                  </Text>
                  <Text style={styles.rowDetail}>Guest link {index + 1}</Text>
                </View>
                {pass.status === 'in' ? null : (
                  <View style={styles.rowActions}>
                    {pass.status === 'unclaimed' ? (
                      <TextAction label="Share link" onPress={() => void shareLink(pass.url, partyTitle)} color={colors.tint} />
                    ) : null}
                    <TextAction
                      label="Take back"
                      onPress={() => takeBack(pass)}
                      color={colors.danger}
                      disabled={revoke.isPending}
                    />
                  </View>
                )}
              </Animated.View>
            ))}
          </View>
        ) : null}

        {error ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {errorText(error)}
          </Text>
        ) : null}

        {canMake ? (
          <View style={styles.button}>
            <PrimaryButton
              label={links.length > 0 ? 'Make another link' : 'Make a link'}
              onPress={makeLink}
              loading={create.isPending}
              accessibilityHint="Makes a link for one spot and opens the share sheet"
            />
          </View>
        ) : links.length > 0 ? (
          <Text style={styles.note}>Every spare spot is out. Take a link back to send it to someone else.</Text>
        ) : (
          <Text style={styles.note}>There is no spare spot on this pass.</Text>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
});

function TextAction({ label, onPress, color, disabled = false }: { label: string; onPress: () => void; color: string; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={layout.hitSlop}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      {({ pressed }) => <Text style={[styles.action, { color }, (pressed || disabled) && styles.actionDim]}>{label}</Text>}
    </Pressable>
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
  list: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.card,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  rowText: {
    flex: 1,
    gap: spacing.xxs,
  },
  rowTitle: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.label,
  },
  rowDetail: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
  rowActions: {
    flexDirection: 'row',
    gap: spacing.base,
  },
  action: {
    ...typography.subheadline,
    fontWeight: '600',
  },
  actionDim: {
    opacity: 0.5,
  },
  error: {
    ...typography.subheadline,
    color: colors.danger,
  },
  note: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
  button: {
    marginTop: spacing.sm,
  },
});
