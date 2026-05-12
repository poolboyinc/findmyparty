import { forwardRef, ReactNode, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { colors, layout, radii, spacing, typography } from '@/constants/theme';

type Props = TextInputProps & {
  leadingIcon?: ReactNode;
  trailingSlot?: ReactNode;
  error?: string | null;
  helper?: string;
};

export const AuthField = forwardRef<TextInput, Props>(function AuthField(
  { leadingIcon, trailingSlot, error, helper, style, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const showError = !!error;

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.field,
          focused && styles.fieldFocused,
          showError && styles.fieldError,
        ]}
      >
        {leadingIcon ? <View style={styles.leading}>{leadingIcon}</View> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.labelTertiary}
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
    borderWidth: 1,
    borderColor: 'transparent',
    height: layout.fieldHeightTall,
    paddingHorizontal: spacing.base,
    gap: spacing.md,
  },
  fieldFocused: {
    borderColor: colors.tint,
    backgroundColor: colors.surfaceElevated,
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
