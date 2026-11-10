import { Children, Fragment, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from '@/components/afterglow/motion';
import { Icon } from '@/components/ui/icon';
import { colors, layout, radii, spacing, typography } from '@/theme';

type IconProps = ComponentProps<typeof Icon>;

/** A solid block of rows with a thin line between them. */
export function InfoCard({ children }: { children: ReactNode }) {
  const rows = Children.toArray(children);
  return (
    <View style={styles.card}>
      {rows.map((row, i) => (
        <Fragment key={i}>
          {i > 0 ? <View style={styles.line} /> : null}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

type RowProps = {
  sfSymbol: IconProps['sfSymbol'];
  ionicon: IconProps['ionicon'];
  text: string;
  /** With this the row is a control and shows a chevron. */
  onPress?: () => void;
  /** Read out instead of `text` when the row is a control. */
  accessibilityLabel?: string;
};

/** One fact with an icon: a place, a price. */
export function InfoRow({ sfSymbol, ionicon, text, onPress, accessibilityLabel }: RowProps) {
  const body = (
    <>
      <Icon sfSymbol={sfSymbol} ionicon={ionicon} size={20} color={colors.labelSecondary} />
      <Text style={styles.text}>{text}</Text>
      {onPress ? <Icon sfSymbol="chevron.right" ionicon="chevron-forward" size={14} color={colors.labelTertiary} /> : null}
    </>
  );

  if (!onPress) return <View style={styles.row}>{body}</View>;
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.98}
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? text}
    >
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  line: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.separator,
    marginHorizontal: spacing.base,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: layout.listItemHeightTall,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  text: {
    ...typography.body,
    color: colors.label,
    flex: 1,
  },
});
