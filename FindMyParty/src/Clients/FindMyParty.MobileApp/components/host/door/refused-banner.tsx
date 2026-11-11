import { StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { PressableScale } from '@/components/afterglow/motion';
import { Icon } from '@/components/ui/icon';
import { colors, radii, spacing, typography } from '@/theme';

/**
 * Over the camera when an offline scan came back refused: "1 offline scan was refused: {reason}".
 * Stays until tapped, so the door does not miss it while scanning the next guest.
 */
export function RefusedBanner({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)}>
      <PressableScale
        onPress={onDismiss}
        style={styles.banner}
        accessibilityRole="button"
        accessibilityLabel={`${text}. Tap to dismiss`}
        accessibilityLiveRegion="assertive"
      >
        <Icon sfSymbol="exclamationmark.triangle.fill" ionicon="warning" size={18} color={colors.label} />
        <Text style={styles.text}>{text}</Text>
        <Icon sfSymbol="xmark" ionicon="close" size={14} color={colors.label} />
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.danger,
    borderRadius: radii.card,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  text: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.label,
    flex: 1,
  },
});
