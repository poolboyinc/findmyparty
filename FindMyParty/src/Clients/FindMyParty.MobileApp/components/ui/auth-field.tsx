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
import { colors, layout, radii, spacing, typography } from '@/theme';

type Props = TextInputProps & {
  leadingIcon?: ReactNode;
  trailingSlot?: ReactNode;
  error?: string | null;
  helper?: string;
};

// Shake on validation error: 3 cycles of ±4pt at 50ms each = 300ms total.
const SHAKE_DISTANCE = 4;
const SHAKE_STEP_MS = 50;

export const AuthField = forwardRef<TextInput, Props>(function AuthField(
  { leadingIcon, trailingSlot, error, helper, style, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const showError = !!error;

  const translateX = useSharedValue(0);
  const hadErrorRef = useRef(false);

  // Trigger the shake only on no-error → error transitions, not on every render
  // where the error persists.
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

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={styles.wrap}>
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

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
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
