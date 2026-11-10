import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react';
import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Display } from '@/components/afterglow/text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { colors, layout, radii, spacing, typography } from '@/theme';

export type SignInSheetRef = {
  present: () => void;
  dismiss: () => void;
};

/** Asks a signed-out guest to sign in before something that needs an account. Opened through its ref. */
export const SignInSheet = forwardRef<SignInSheetRef>(function SignInSheet(_, ref) {
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);

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
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.6} pressBehavior="close" />
    ),
    [],
  );

  const signIn = () => {
    sheetRef.current?.dismiss();
    router.push('/login');
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.background}
    >
      <BottomSheetView style={[styles.content, { paddingBottom: insets.bottom + spacing.base }]}>
        <Display size="sm" accessibilityRole="header">
          Sign in first
        </Display>
        <Text style={styles.body}>You need an account to keep parties and take passes.</Text>
        <PrimaryButton label="Sign in" onPress={signIn} accessibilityHint="Opens the sign in screen" />
      </BottomSheetView>
    </BottomSheetModal>
  );
});

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
  body: {
    ...typography.subheadline,
    color: colors.labelSecondary,
  },
});
