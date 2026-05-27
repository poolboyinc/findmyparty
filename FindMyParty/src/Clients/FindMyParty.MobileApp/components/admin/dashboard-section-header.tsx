import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, layout, spacing, typography, weights } from '@/theme';

type Props = {
  title: string;
  /** Optional trailing action — renders a tappable "{label} →" link on the right. */
  action?: {
    label: string;
    onPress: () => void;
  };
};

/**
 * Host dashboard section header: a bold title with an optional trailing text
 * action (e.g. "See all →"). Distinct from the consumer `SectionHeader`, which
 * exposes a decorative trailing glyph rather than a tappable affordance.
 *
 * Usage:
 *   <DashboardSectionHeader
 *     title="Next up"
 *     action={{ label: 'See all', onPress: goManage }}
 *   />
 */
export function DashboardSectionHeader({ title, action }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {action ? (
        <Pressable
          onPress={action.onPress}
          hitSlop={layout.hitSlop}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <Text style={styles.actionLabel}>{action.label} →</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    ...typography.title2,
    fontWeight: weights.bold,
    color: colors.label,
  },
  action: {
    paddingVertical: spacing.xxs,
  },
  actionPressed: {
    opacity: 0.6,
  },
  actionLabel: {
    ...typography.subheadline,
    fontWeight: weights.semibold,
    color: colors.tint,
  },
});
