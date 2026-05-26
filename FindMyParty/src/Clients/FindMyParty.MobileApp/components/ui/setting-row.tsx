import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SymbolViewProps } from 'expo-symbols';
import type { Ionicons } from '@expo/vector-icons';
import { Icon } from '@/components/ui/icon';
import { colors, layout, spacing, typography } from '@/theme';

type Variant = 'default' | 'destructive';

type Props = {
  sfSymbol: SymbolViewProps['name'];
  ionicon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  /** Defaults to true on `default` rows. Forced false on `destructive` rows. */
  showChevron?: boolean;
  /** `default` (normal label) or `destructive` (danger color, no chevron). */
  variant?: Variant;
  /** Optional trailing value text (e.g. "Premium" beside a row). */
  value?: string;
};

/**
 * Grouped-list settings row in the iOS Settings pattern: icon left, label
 * center, optional trailing value, optional chevron right. The parent
 * container provides the surface background, rounded corners, and inserts
 * `<View style={divider}>` siblings between rows for hairline separators.
 *
 * Press feedback: pressed state applies a subtle fillQuaternary wash across
 * the row, matching iOS's native grouped-list tap highlight.
 */
export function SettingRow({
  sfSymbol,
  ionicon,
  label,
  onPress,
  showChevron = true,
  variant = 'default',
  value,
}: Props) {
  const isDestructive = variant === 'destructive';
  const textColor = isDestructive ? colors.danger : colors.label;
  const iconColor = isDestructive ? colors.danger : colors.labelSecondary;
  const renderChevron = showChevron && !isDestructive;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.iconWrap}>
        <Icon sfSymbol={sfSymbol} ionicon={ionicon} size={20} color={iconColor} />
      </View>
      <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
        {label}
      </Text>
      {value ? (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {renderChevron ? (
        <Icon
          sfSymbol="chevron.right"
          ionicon="chevron-forward"
          size={14}
          color={colors.labelTertiary}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  rowPressed: {
    backgroundColor: colors.fillQuaternary,
  },
  iconWrap: {
    width: 28,
    alignItems: 'center',
  },
  label: {
    ...typography.body,
    flex: 1,
  },
  value: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    marginRight: spacing.xs,
  },
});
