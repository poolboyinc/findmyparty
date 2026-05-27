import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SymbolViewProps } from 'expo-symbols';
import type { Ionicons } from '@expo/vector-icons';
import { Icon } from '@/components/ui/icon';
import { colors, layout, radii, spacing, typography, weights } from '@/theme';

type Props = {
  sfSymbol: SymbolViewProps['name'];
  ionicon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  action?: {
    label: string;
    onPress: () => void;
  };
};

/**
 * Empty state for sections that have no content. Renders an SF Symbol, a
 * headline, supporting text, and an optional secondary action button.
 */
export function EmptyState({ sfSymbol, ionicon, title, body, action }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Icon sfSymbol={sfSymbol} ionicon={ionicon} size={32} color={colors.labelTertiary} />
      </View>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.body}>{body}</Text>
      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.actionLabel}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.headline,
    color: colors.label,
    textAlign: 'center',
  },
  body: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    textAlign: 'center',
  },
  action: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
  },
  actionLabel: {
    ...typography.subheadline,
    fontWeight: weights.semibold,
    color: colors.tint,
  },
});
