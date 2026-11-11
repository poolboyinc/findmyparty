import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Avatars } from '@/components/afterglow/avatars';
import { PressableScale } from '@/components/afterglow/motion';
import { colors, layout, radii, spacing, typography } from '@/theme';
import { personLine } from './people';

const AVATAR = 40;

type Person = { displayName: string; handle: string; levelName: string; initial: string };

type Props = {
  person: Person;
  /** Buttons at the end of the row. */
  children?: ReactNode;
  /** Opens the row's menu (Remove, Report, Block). Without it the row is not pressable. */
  onPress?: () => void;
  accessibilityHint?: string;
};

/** A person: their initial in a cyan ring (your people are cyan), their name, "@handle, level", and what you can do. */
export function PersonRow({ person, children, onPress, accessibilityHint }: Props) {
  const line = personLine(person);
  const words = (
    <>
      <Avatars initials={[person.initial || person.displayName]} size={AVATAR} backdrop={colors.surface} />
      <View style={styles.words}>
        <Text style={styles.name} numberOfLines={1}>
          {person.displayName}
        </Text>
        <Text style={styles.line} numberOfLines={1}>
          {line}
        </Text>
      </View>
    </>
  );

  return (
    <View style={styles.row}>
      {onPress ? (
        <PressableScale
          onPress={onPress}
          scaleTo={0.98}
          style={styles.main}
          accessibilityRole="button"
          accessibilityLabel={`${person.displayName}, ${line}`}
          accessibilityHint={accessibilityHint}
        >
          {words}
        </PressableScale>
      ) : (
        <View style={styles.main} accessible accessibilityRole="text" accessibilityLabel={`${person.displayName}, ${line}`}>
          {words}
        </View>
      )}
      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress?: () => void;
  /** `fill`: the step forward (Add, Accept). `quiet`: the rest (Decline, Asked, Unblock). */
  tone?: 'fill' | 'quiet';
  busy?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
};

/** A small flat button for a person row. */
export function RowButton({ label, onPress, tone = 'fill', busy, disabled, accessibilityLabel }: ButtonProps) {
  const off = disabled || busy || !onPress;
  return (
    <PressableScale
      onPress={onPress}
      disabled={off}
      hitSlop={layout.hitSlop}
      style={[styles.button, tone === 'fill' ? styles.fill : styles.quiet, disabled && styles.off]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: off, busy: !!busy }}
    >
      {busy ? (
        <ActivityIndicator size="small" color={colors.label} />
      ) : (
        <Text style={[styles.buttonLabel, tone === 'quiet' && styles.quietLabel]}>{label}</Text>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md - 2,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  words: {
    flex: 1,
    gap: spacing.xxs,
  },
  name: {
    ...typography.body,
    fontWeight: '600',
    color: colors.label,
  },
  line: {
    ...typography.footnote,
    color: colors.labelSecondary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  button: {
    minHeight: 33,
    minWidth: 64,
    paddingHorizontal: spacing.md,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: {
    backgroundColor: colors.action,
  },
  quiet: {
    backgroundColor: colors.surfaceElevated,
  },
  off: {
    opacity: 0.45,
  },
  buttonLabel: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.label,
  },
  quietLabel: {
    color: colors.labelSecondary,
  },
});
