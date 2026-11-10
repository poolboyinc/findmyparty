import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/afterglow/motion';
import { Display } from '@/components/afterglow/text';
import { colors, layout, radii, spacing } from '@/theme';

type Props = {
  /** The screen's title, in the display face, under the back button. */
  title: string;
  /** Override the default `router.back()` behavior. */
  onBack?: () => void;
  /**
   * When true, disables the back button entirely. Used during async submission
   * to prevent navigation race conditions while a network request is in flight.
   */
  disabled?: boolean;
  /** Render the back button. Defaults to true. Screens with nothing to go back to pass `false`. */
  showBack?: boolean;
};

const BACK_SIZE = 40;

/**
 * Top of a pushed screen: a flat back button, then the title on its own line.
 * It pads for the top safe area itself.
 */
export function AuthHeader({ title, onBack, disabled = false, showBack = true }: Props) {
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (onBack) onBack();
    else router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      {showBack ? (
        <PressableScale
          onPress={handleBack}
          disabled={disabled}
          hitSlop={layout.hitSlop}
          accessibilityRole="button"
          accessibilityLabel="Back"
          accessibilityState={{ disabled }}
          style={[styles.back, disabled && styles.backDisabled]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.label} />
        </PressableScale>
      ) : null}
      <Display size="md" accessibilityRole="header">
        {title}
      </Display>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: layout.screenMargin,
    paddingBottom: spacing.md,
    gap: spacing.base,
  },
  back: {
    width: BACK_SIZE,
    height: BACK_SIZE,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backDisabled: {
    opacity: 0.4,
  },
});
