import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, spacing, typography } from '@/theme';

type Props = {
  /** Screen title rendered centered between the back button and a matching spacer. */
  title: string;
  /** Override the default `router.back()` behavior. */
  onBack?: () => void;
  /**
   * When true, disables the back button entirely. Used during async submission
   * to prevent navigation race conditions while a network request is in flight.
   */
  disabled?: boolean;
  /**
   * Render the back button. Defaults to true. Tab-root screens (which have no
   * screen to pop back to) pass `false`; a matching spacer keeps the title
   * visually centered.
   */
  showBack?: boolean;
};

const BACK_SIZE = 44;

/**
 * Top-of-screen header used across the auth flow (Log In, Sign Up, Forgot Password).
 * Renders a circular glass back button on the left, a centered title, and a
 * matching-width spacer on the right so the title sits visually centered on screen.
 *
 * The BlurView starts at intensity 40 / tint="dark" — adjust intensity if streaks
 * become visible during scroll on real devices.
 */
export function AuthHeader({ title, onBack, disabled = false, showBack = true }: Props) {
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (disabled) return;
    Haptics.selectionAsync();
    if (onBack) onBack();
    else router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      {showBack ? (
        <Pressable
          onPress={handleBack}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="Back"
          accessibilityHint="Returns to the previous screen"
          accessibilityState={{ disabled }}
          hitSlop={layout.hitSlop}
          style={({ pressed }) => [
            styles.backWrap,
            pressed && !disabled && styles.backPressed,
            disabled && styles.backDisabled,
          ]}
        >
          <BlurView intensity={40} tint="dark" style={styles.backBlur}>
            <Ionicons name="chevron-back" size={22} color={colors.label} />
          </BlurView>
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}
      <Text
        style={styles.title}
        accessibilityRole="header"
        numberOfLines={1}
        allowFontScaling
      >
        {title}
      </Text>
      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  backWrap: {
    width: BACK_SIZE,
    height: BACK_SIZE,
    borderRadius: BACK_SIZE / 2,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
  },
  backBlur: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.95 }],
  },
  backDisabled: {
    opacity: 0.4,
  },
  title: {
    flex: 1,
    ...typography.title1,
    color: colors.label,
    textAlign: 'center',
  },
  spacer: {
    width: BACK_SIZE,
    height: BACK_SIZE,
  },
});
