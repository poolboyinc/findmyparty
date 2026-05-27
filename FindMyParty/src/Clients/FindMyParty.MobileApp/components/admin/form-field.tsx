import { forwardRef, ReactNode, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors, layout, radii, spacing, typography, weights } from '@/theme';

// Shake on validation error: 3 cycles of ±4pt at 50ms each = 300ms total.
// Mirrors `components/ui/auth-field.tsx`.
const SHAKE_DISTANCE = 4;
const SHAKE_STEP_MS = 50;

// Minimum tappable height of the text-area before it grows with content.
const TEXT_AREA_MIN_HEIGHT = 112;

type BaseProps = TextInputProps & {
  /** Persistent label rendered above the field. */
  label: string;
  leadingIcon?: ReactNode;
  trailingSlot?: ReactNode;
  error?: string | null;
  helper?: string;
};

function useShake(showError: boolean) {
  const translateX = useSharedValue(0);
  const hadErrorRef = useRef(false);

  useEffect(() => {
    if (showError && !hadErrorRef.current) {
      translateX.value = withSequence(
        withTiming(-SHAKE_DISTANCE, { duration: SHAKE_STEP_MS }),
        withTiming(SHAKE_DISTANCE, { duration: SHAKE_STEP_MS }),
        withTiming(-SHAKE_DISTANCE, { duration: SHAKE_STEP_MS }),
        withTiming(SHAKE_DISTANCE, { duration: SHAKE_STEP_MS }),
        withTiming(-SHAKE_DISTANCE, { duration: SHAKE_STEP_MS }),
        withTiming(0, { duration: SHAKE_STEP_MS }),
      );
    }
    hadErrorRef.current = showError;
  }, [showError, translateX]);

  return useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
}

/**
 * Labeled single-line text field for host-portal forms. Same focus ring,
 * inline error + shake, elevated fill, and `radii.field` treatment as the
 * consumer `AuthField`, plus a persistent label above the input. Uses
 * `layout.fieldHeightTall` to keep one consistent input height across the app.
 *
 * Usage:
 *   <FormField label="Party name" value={name} onChangeText={setName}
 *     error={nameError} placeholder="e.g. Midnight Rooftop" />
 */
export const FormField = forwardRef<TextInput, BaseProps>(function FormField(
  { label, leadingIcon, trailingSlot, error, helper, style, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const showError = !!error;
  const shakeStyle = useShake(showError);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Animated.View
        style={[
          styles.field,
          focused && styles.fieldFocused,
          showError && styles.fieldError,
          shakeStyle,
        ]}
      >
        {leadingIcon ? <View style={styles.leading}>{leadingIcon}</View> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.labelTertiary}
          style={[styles.input, style]}
          accessibilityLabel={label}
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
      </Animated.View>
      {showError ? (
        <Animated.Text
          entering={FadeIn.duration(200)}
          style={styles.error}
          accessibilityLiveRegion="polite"
        >
          {error}
        </Animated.Text>
      ) : helper ? (
        <Text style={styles.helper}>{helper}</Text>
      ) : null}
    </View>
  );
});

type TextAreaProps = BaseProps & {
  /** Min height of the multiline box. Defaults to 112pt. */
  minHeight?: number;
};

/**
 * Multiline variant of `FormField`. Grows from `minHeight`, shows a live
 * character count when `maxLength` is provided.
 *
 * Usage:
 *   <FormTextArea label="Description" value={desc} onChangeText={setDesc}
 *     maxLength={500} placeholder="What's the vibe?" />
 */
export const FormTextArea = forwardRef<TextInput, TextAreaProps>(function FormTextArea(
  {
    label,
    error,
    helper,
    style,
    minHeight = TEXT_AREA_MIN_HEIGHT,
    maxLength,
    value,
    onFocus,
    onBlur,
    ...rest
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const showError = !!error;
  const shakeStyle = useShake(showError);
  const charCount = typeof value === 'string' ? value.length : 0;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Animated.View
        style={[
          styles.field,
          styles.fieldMultiline,
          { minHeight },
          focused && styles.fieldFocused,
          showError && styles.fieldError,
          shakeStyle,
        ]}
      >
        <TextInput
          ref={ref}
          multiline
          maxLength={maxLength}
          value={value}
          textAlignVertical="top"
          placeholderTextColor={colors.labelTertiary}
          style={[styles.input, styles.inputMultiline, style]}
          accessibilityLabel={label}
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
      </Animated.View>
      <View style={styles.footerRow}>
        <View style={styles.footerMessage}>
          {showError ? (
            <Animated.Text
              entering={FadeIn.duration(200)}
              style={styles.error}
              accessibilityLiveRegion="polite"
            >
              {error}
            </Animated.Text>
          ) : helper ? (
            <Text style={styles.helper}>{helper}</Text>
          ) : null}
        </View>
        {typeof maxLength === 'number' ? (
          <Text style={styles.charCount}>{`${charCount}/${maxLength}`}</Text>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  label: {
    ...typography.subheadline,
    fontWeight: weights.semibold,
    color: colors.labelSecondary,
    paddingHorizontal: spacing.xs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radii.field,
    borderWidth: 1,
    borderColor: colors.hairline,
    height: layout.fieldHeightTall,
    paddingHorizontal: spacing.base,
    gap: spacing.md,
  },
  fieldMultiline: {
    height: undefined,
    alignItems: 'stretch',
    paddingVertical: spacing.md,
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
  inputMultiline: {
    height: '100%',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  footerMessage: {
    flexShrink: 1,
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
  charCount: {
    ...typography.footnote,
    color: colors.labelTertiary,
    paddingHorizontal: spacing.xs,
  },
});
