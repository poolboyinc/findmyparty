import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { PrimaryButton } from '@/components/ui/primary-button';
import { colors, layout, radii, spacing, typography, weights } from '@/theme';

export type SignInSheetRef = {
  present: () => void;
  dismiss: () => void;
};

/**
 * Bottom sheet shown when an unauthenticated user tries to save a party.
 * Imperative API via ref — parent calls `.present()` from its onHeartPress
 * handler.
 */
export const SignInSheet = forwardRef<SignInSheetRef>(function SignInSheet(_, ref) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['38%'], []);

  useImperativeHandle(
    ref,
    () => ({
      present: () => sheetRef.current?.present(),
      dismiss: () => sheetRef.current?.dismiss(),
    }),
    [],
  );

  const renderBackdrop = (props: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      opacity={0.5}
    />
  );

  const handleSignIn = () => {
    sheetRef.current?.dismiss();
    router.push('/login');
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.background}
    >
      <BottomSheetView style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">
          Sign in to save events
        </Text>
        <Text style={styles.body}>
          Create an account or sign in to keep track of parties you&apos;re interested in.
        </Text>
        <View style={styles.cta}>
          <PrimaryButton
            label="Sign In"
            onPress={handleSignIn}
            accessibilityHint="Opens the log in screen"
          />
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
  },
  handle: {
    backgroundColor: colors.labelTertiary,
    width: layout.sheetHandleWidth,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  title: {
    ...typography.title2,
    fontWeight: weights.bold,
    color: colors.label,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    color: colors.labelSecondary,
    textAlign: 'center',
  },
  cta: {
    marginTop: spacing.md,
  },
});
