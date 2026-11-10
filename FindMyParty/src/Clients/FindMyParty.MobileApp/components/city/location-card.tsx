import { Pressable, StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { Display } from '@/components/afterglow/text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { colors, layout, radii, spacing, typography } from '@/theme';
import { CARD_ENTER, CARD_EXIT } from './card-motion';

type Props = {
  /** "Use my location": the screen then shows the system prompt. */
  onAllow: () => void;
  /** "Not now": the card stays away for the rest of the session. */
  onNotNow: () => void;
  /** The system prompt is up. */
  asking: boolean;
};

/**
 * Asks for location in the app's own words before the system does. Shown over the lower part of
 * the map only while the permission has never been answered; the map behind it works without it.
 */
export function LocationCard({ onAllow, onNotNow, asking }: Props) {
  return (
    <Animated.View entering={CARD_ENTER} exiting={CARD_EXIT} style={styles.card}>
      <Display size="sm" accessibilityRole="header">
        Turn the lights on.
      </Display>
      <Text style={styles.body}>
        We use your location to show what is near you and to walk you there. It is not shared with anyone.
      </Text>
      <PrimaryButton label="Use my location" onPress={onAllow} loading={asking} />
      <Pressable
        onPress={onNotNow}
        hitSlop={layout.hitSlop}
        accessibilityRole="button"
        accessibilityLabel="Not now"
        style={({ pressed }) => [styles.later, pressed && styles.pressedLink]}
      >
        <Text style={styles.laterLabel}>Not now</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.sheet,
    padding: spacing.lg,
    gap: spacing.md,
  },
  body: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    marginBottom: spacing.xs,
  },
  later: {
    alignSelf: 'center',
    paddingVertical: spacing.xs,
  },
  laterLabel: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.labelSecondary,
  },
  pressedLink: {
    opacity: 0.6,
  },
});
