import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { router } from 'expo-router';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  useBottomSheetSpringConfigs,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { springs } from '@/components/afterglow/motion';
import { colors, layout, radii, spacing } from '@/theme';
import { ScanResultContent, type ShownScanState } from './scan-result-content';
import type { ScanState } from './use-door-scan';

/** How long "2 in" stays up before the sheet closes by itself. */
const ADMITTED_CLOSE_MS = 1_200;
/**
 * `present()` mounts the sheet a frame later. A `dismiss()` that lands before that leaves the modal
 * marked as closing for good (it never opens again), so a dismiss this soon after a present waits.
 */
const PRESENT_SETTLE_MS = 150;

type Props = {
  state: ScanState;
  /** False when the scanner is not the screen in front: the sheet must not stay over another tab. */
  focused: boolean;
  onAdmit: (code: string, count: number) => void;
  onRetry: (code: string, during: 'check' | 'admit') => void;
  /** The result is gone from the screen: scanning may resume. */
  onDismissed: () => void;
};

function shownState(state: ScanState): ShownScanState | null {
  return state.phase === 'idle' || state.phase === 'checking' ? null : state;
}

/**
 * The result of a scan, as a sheet over the camera. It arrives on a spring, follows the finger, and
 * closing it by any means (a button, a swipe, a tap outside, or by itself after an entry) is what
 * lets the next pass be read.
 */
export function ScanResultSheet({ state, focused, onAdmit, onRetry, onDismissed }: Props) {
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);
  const presented = useRef(false);
  const presentedAt = useRef(0);
  const pendingDismiss = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationConfigs = useBottomSheetSpringConfigs({ ...springs.smooth, overshootClamping: true });

  // The sheet keeps drawing its last result while it slides away.
  const shown = shownState(state);
  const [lastShown, setLastShown] = useState<ShownScanState | null>(null);
  if (shown && shown !== lastShown) setLastShown(shown);
  const content = shown ?? lastShown;

  /** Closes the sheet if it is up. `onDismiss` then reports that it has gone. */
  const dismiss = useCallback(() => {
    if (!presented.current || pendingDismiss.current) return;
    const wait = PRESENT_SETTLE_MS - (Date.now() - presentedAt.current);
    if (wait <= 0) {
      sheetRef.current?.dismiss();
      return;
    }
    pendingDismiss.current = setTimeout(() => {
      pendingDismiss.current = null;
      sheetRef.current?.dismiss();
    }, wait);
  }, []);

  useEffect(
    () => () => {
      if (pendingDismiss.current) clearTimeout(pendingDismiss.current);
    },
    [],
  );

  const wantOpen = shown !== null && focused;
  const inProgress = state.phase !== 'idle';
  useEffect(() => {
    if (wantOpen) {
      if (!presented.current) {
        presented.current = true;
        presentedAt.current = Date.now();
        sheetRef.current?.present();
      }
      return;
    }
    if (presented.current) {
      dismiss();
      return;
    }
    // The scanner left the screen with a scan in flight and no sheet up: nothing to close, just resume.
    if (!focused && inProgress) onDismissed();
  }, [wantOpen, focused, inProgress, dismiss, onDismissed]);

  const admitted = state.phase === 'admitted';
  useEffect(() => {
    if (!admitted) return;
    const timer = setTimeout(dismiss, ADMITTED_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [admitted, dismiss]);

  const handleDismissed = useCallback(() => {
    presented.current = false;
    onDismissed();
  }, [onDismissed]);

  const signIn = useCallback(() => {
    dismiss();
    router.replace('/admin/login');
  }, [dismiss]);

  // While an entry is being sent the sheet stays put, so its answer is always seen.
  const locked = state.phase === 'valid' && state.admitting;

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.35}
        pressBehavior={locked ? 'none' : 'close'}
      />
    ),
    [locked],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      enablePanDownToClose={!locked}
      animationConfigs={animationConfigs}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.background}
      onDismiss={handleDismissed}
    >
      <BottomSheetView style={[styles.content, { paddingBottom: insets.bottom + spacing.lg }]}>
        {content ? (
          <ScanResultContent state={content} onAdmit={onAdmit} onRetry={onRetry} onClose={dismiss} onSignIn={signIn} />
        ) : null}
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
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.sm,
  },
});
