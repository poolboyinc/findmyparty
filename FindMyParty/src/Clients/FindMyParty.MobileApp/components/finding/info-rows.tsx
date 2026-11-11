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
  /** `earned`: a perk the guest holds, icon and words in lime. */
  tone?: 'plain' | 'earned';
};

/** One fact with an icon: a place, a price, a perk. */
export function InfoRow({ sfSymbol, ionicon, text, onPress, accessibilityLabel, tone = 'plain' }: RowProps) {
  const earned = tone === 'earned';
  const body = (
    <>
      <View style={styles.icon}>
        <Icon sfSymbol={sfSymbol} ionicon={ionicon} size={19} color={earned ? colors.earned : colors.labelSecondary} />
      </View>
      <Text style={[styles.text, earned && styles.earned]}>{text}</Text>
      {onPress ? <Icon sfSymbol="chevron.right" ionicon="chevron-forward" size={13} color={colors.labelTertiary} /> : null}
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

type LineUpProps = {
  /** "23:00": when the set starts. */
  time: string;
  /** The set is playing now: its time is in the crowd's colour. */
  playing: boolean;
  name: string;
  /** "DJ", "Band". */
  role?: string | null;
};

/** One act in the line-up: set time in the left column, the name, and what they are on the right. */
export function LineUpRow({ time, playing, name, role }: LineUpProps) {
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={[name, role, time && (playing ? `on since ${time}` : `from ${time}`)].filter(Boolean).join(', ')}
    >
      <Text style={[styles.setTime, playing && styles.setTimeNow]}>{time}</Text>
      <Text style={styles.act} numberOfLines={2}>
        {name}
      </Text>
      {role ? <Text style={styles.role}>{role}</Text> : null}
    </View>
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
    backgroundColor: colors.hairline,
    marginHorizontal: spacing.md + 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md + 2,
    minHeight: layout.listItemHeight + 6,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm + 2,
  },
  icon: {
    width: 22,
    alignItems: 'center',
  },
  text: {
    ...typography.subheadline,
    color: colors.label,
    flex: 1,
  },
  earned: {
    color: colors.earned,
  },
  setTime: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.labelTertiary,
    minWidth: 52,
    fontVariant: ['tabular-nums'],
  },
  setTimeNow: {
    color: colors.crowd,
  },
  act: {
    ...typography.subheadline,
    fontWeight: '700',
    color: colors.label,
    flex: 1,
  },
  role: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
});
