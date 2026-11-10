import { StyleSheet, Text, View } from 'react-native';
import type { SymbolViewProps } from 'expo-symbols';
import type { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '@/components/afterglow/motion';
import { Icon } from '@/components/ui/icon';
import { colors, layout, spacing, typography } from '@/theme';

type Variant = 'default' | 'accent' | 'destructive';

type Props = {
  label: string;
  onPress: () => void;
  /** An icon before the label. Rows are plain without one; give both names or neither. */
  sfSymbol?: SymbolViewProps['name'];
  ionicon?: keyof typeof Ionicons.glyphMap;
  /** Defaults to true. Never shown on `destructive` rows. */
  showChevron?: boolean;
  /** `accent`: the one row that changes mode (tint). `destructive`: danger colour, no chevron. */
  variant?: Variant;
  /** Optional value at the end of the row. */
  value?: string;
};

const LABEL_COLOR: Record<Variant, string> = {
  default: colors.label,
  accent: colors.tint,
  destructive: colors.danger,
};

/**
 * A plain row in a settings list: a label, sometimes a value, a chevron. It has no
 * background of its own: the parent is the solid block (`colors.surface`, rounded) and
 * puts a hairline between rows.
 */
export function SettingRow({ label, onPress, sfSymbol, ionicon, showChevron = true, variant = 'default', value }: Props) {
  const color = LABEL_COLOR[variant];

  return (
    <PressableScale onPress={onPress} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={label} style={styles.row}>
      {sfSymbol && ionicon ? (
        <View style={styles.icon}>
          <Icon sfSymbol={sfSymbol} ionicon={ionicon} size={20} color={variant === 'default' ? colors.labelSecondary : color} />
        </View>
      ) : null}
      <Text style={[styles.label, { color }, variant === 'accent' && styles.labelAccent]}>{label}</Text>
      {value ? (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {showChevron && variant !== 'destructive' ? (
        <Icon sfSymbol="chevron.right" ionicon="chevron-forward" size={14} color={colors.labelTertiary} />
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.listItemHeightTall,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  icon: {
    width: 28,
    alignItems: 'center',
  },
  label: {
    ...typography.body,
    flex: 1,
  },
  labelAccent: {
    fontWeight: '600',
  },
  value: {
    ...typography.body,
    color: colors.labelSecondary,
  },
});
