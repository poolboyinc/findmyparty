import { forwardRef, type ReactNode, useState } from 'react';
import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import { colors, layout, radii, spacing, typography } from '@/theme';

type Props = TextInputProps & {
  leadingIcon?: ReactNode;
  trailingSlot?: ReactNode;
  /** Shown under the field in the danger colour, in place of `helper`. */
  error?: string | null;
  /** A standing note under the field, e.g. the password rules. */
  helper?: string;
};

const BORDER_WIDTH = 1.5;

/**
 * A plain form field: a solid block with no outline. The border only ever shows a state:
 * the tint colour while the field has focus, the danger colour when it holds an error.
 */
export const AuthField = forwardRef<TextInput, Props>(function AuthField(
  { leadingIcon, trailingSlot, error, helper, style, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const showError = !!error;

  return (
    <View style={styles.wrap}>
      <View style={[styles.field, focused && styles.fieldFocused, showError && styles.fieldError]}>
        {leadingIcon ? <View style={styles.leading}>{leadingIcon}</View> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.labelTertiary}
          selectionColor={colors.tint}
          style={[styles.input, style]}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {trailingSlot ? <View style={styles.trailing}>{trailingSlot}</View> : null}
      </View>
      {showError ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : helper ? (
        <Text style={styles.helper}>{helper}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.field,
    // Always there, in the fill's own colour, so the field does not change size when it shows.
    borderWidth: BORDER_WIDTH,
    borderColor: colors.surface,
    minHeight: layout.fieldHeightTall,
    paddingHorizontal: spacing.base,
    gap: spacing.md,
  },
  fieldFocused: {
    borderColor: colors.tint,
  },
  fieldError: {
    borderColor: colors.danger,
  },
  leading: {
    width: 22,
    alignItems: 'center',
  },
  trailing: {
    paddingLeft: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.label,
    paddingVertical: 0,
  },
  helper: {
    ...typography.footnote,
    color: colors.labelSecondary,
    paddingHorizontal: spacing.xs,
  },
  error: {
    ...typography.footnote,
    color: colors.danger,
    paddingHorizontal: spacing.xs,
  },
});
