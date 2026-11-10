import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';

type Props = {
  title: string;
  /** A rose dot before the title: this section is the live crowd ("Glowing now"). */
  live?: boolean;
};

/** A quiet label above a group: "Later tonight", "Line-up". Sentence case, system font. */
export function SectionHeader({ title, live = false }: Props) {
  return (
    <View style={styles.row} accessibilityRole="header">
      {live ? <View style={styles.dot} /> : null}
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.crowd,
  },
  title: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.labelSecondary,
  },
});
