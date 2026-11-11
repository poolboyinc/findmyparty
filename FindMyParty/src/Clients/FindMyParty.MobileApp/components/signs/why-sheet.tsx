import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/afterglow/motion';
import { colors, layout, radii, spacing, typography } from '@/theme';

type Props = {
  /** Who paid; null closes the sheet. */
  advertiser: string | null;
  onDismiss: () => void;
};

/** A just-presented sheet gets this long to mount before it may be dismissed (see `VenueSheet`). */
const PRESENT_SETTLE_MS = 150;

/**
 * "Why am I seeing this?" from a sponsored sign's card (S-19): who paid for it, and that paying never
 * changes how bright a venue looks. It opens over the card, which stays where it was underneath.
 */
export function WhySheet({ advertiser, onDismiss }: Props) {
  const sheet = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const presented = useRef(false);
  const presentedAt = useRef(0);
  // Keep the name while the sheet slides away.
  const [last, setLast] = useState<string | null>(advertiser);
  useEffect(() => {
    if (advertiser) setLast(advertiser);
  }, [advertiser]);
  const open = advertiser !== null;

  useEffect(() => {
    if (open) {
      presented.current = true;
      presentedAt.current = Date.now();
      sheet.current?.present();
      return;
    }
    if (!presented.current) return;
    const wait = Math.max(0, PRESENT_SETTLE_MS - (Date.now() - presentedAt.current));
    const timer = setTimeout(() => {
      presented.current = false;
      sheet.current?.dismiss();
    }, wait);
    return () => clearTimeout(timer);
  }, [open]);

  const shown = advertiser ?? last ?? '';

  return (
    <BottomSheetModal
      ref={sheet}
      stackBehavior="push"
      enableDynamicSizing
      enablePanDownToClose
      onDismiss={() => {
        presented.current = false;
        onDismiss();
      }}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.background}
    >
      <BottomSheetView style={[styles.content, { paddingBottom: insets.bottom + spacing.base }]}>
        <Text style={styles.title} accessibilityRole="header">
          Why am I seeing this?
        </Text>
        <Text style={styles.body}>
          {shown} paid for this sign. Signs never change a venue&apos;s light.
        </Text>
        <PressableScale
          onPress={() => sheet.current?.dismiss()}
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Text style={styles.buttonLabel}>Got it</Text>
        </PressableScale>
      </BottomSheetView>
    </BottomSheetModal>
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
    paddingHorizontal: 22,
    paddingTop: spacing.xs,
    gap: spacing.md,
  },
  title: {
    ...typography.headline,
    color: colors.label,
  },
  body: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
  button: {
    height: layout.minTouchTarget + 3,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  buttonLabel: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.label,
  },
});
