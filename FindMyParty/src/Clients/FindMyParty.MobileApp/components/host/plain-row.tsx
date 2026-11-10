import { StyleSheet, Text } from 'react-native';
import { PressableScale } from '@/components/afterglow/motion';
import { Icon } from '@/components/ui/icon';
import { colors, layout, spacing, typography } from '@/theme';

type Props = {
  label: string;
  onPress: () => void;
  /** Red label and no chevron, for signing out. */
  destructive?: boolean;
};

/** A plain row that goes somewhere: a label and a chevron on the screen's own background. */
export function PlainRow({ label, onPress, destructive = false }: Props) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.99} style={styles.row} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={[styles.label, destructive && styles.destructive]}>{label}</Text>
      {destructive ? null : <Icon sfSymbol="chevron.right" ionicon="chevron-forward" size={14} color={colors.labelTertiary} />}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: layout.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  label: {
    ...typography.body,
    color: colors.label,
    flexShrink: 1,
  },
  destructive: {
    color: colors.danger,
  },
});
