import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/afterglow/motion';
import { Display } from '@/components/afterglow/text';
import { Icon } from '@/components/ui/icon';
import { colors, layout, radii, spacing } from '@/theme';

type Props = {
  title: string;
  /** Default true. Screens with nothing to go back to pass false. */
  showBack?: boolean;
  /** Replaces the default `router.back()`. */
  onBack?: () => void;
  /** Stops the back button while a request is in flight. */
  disabled?: boolean;
};

/** The header of a pushed host screen: a solid back button and the title. No blur, no outline. */
export function HostHeader({ title, showBack = true, onBack, disabled = false }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing.sm }]}>
      {showBack ? (
        <PressableScale
          onPress={() => (onBack ? onBack() : router.back())}
          disabled={disabled}
          hitSlop={layout.hitSlop}
          style={[styles.back, disabled && styles.backDisabled]}
          accessibilityRole="button"
          accessibilityLabel="Back"
          accessibilityState={{ disabled }}
        >
          <Icon sfSymbol="chevron.left" ionicon="chevron-back" size={18} color={colors.label} />
        </PressableScale>
      ) : null}
      <Display size="sm" style={styles.title} numberOfLines={1} accessibilityRole="header">
        {title}
      </Display>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: layout.screenMargin,
    paddingBottom: spacing.sm,
    backgroundColor: colors.bg,
  },
  back: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backDisabled: {
    opacity: 0.4,
  },
  title: {
    flex: 1,
  },
});
