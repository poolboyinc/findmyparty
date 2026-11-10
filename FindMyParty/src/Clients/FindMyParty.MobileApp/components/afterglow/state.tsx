import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { errorText } from '@/services/errorText';
import { PressableScale } from './motion';

/** Centered spinner for a screen or section that is loading for the first time. */
export function Loading() {
  return (
    <View style={styles.center} accessibilityLabel="Loading">
      <ActivityIndicator color={colors.labelSecondary} />
    </View>
  );
}

type FailedProps = {
  /** Whatever the query or mutation threw. The sentence comes from `errorText`. */
  error: unknown;
  onRetry?: () => void;
};

/** What to show when loading failed: the reason in one sentence and a way to try again. Never an empty list. */
export function Failed({ error, onRetry }: FailedProps) {
  return (
    <View style={styles.center}>
      <Text style={styles.message}>{errorText(error)}</Text>
      {onRetry ? (
        <PressableScale onPress={onRetry} style={styles.retry} accessibilityRole="button" accessibilityLabel="Try again">
          <Text style={styles.retryLabel}>Try again</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

type EmptyProps = {
  title: string;
  body?: string;
};

/** A calm line for "nothing here yet". Only for a successful load that returned nothing. */
export function Empty({ title, body }: EmptyProps) {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.message}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  message: {
    ...typography.subheadline,
    color: colors.labelSecondary,
    textAlign: 'center',
  },
  emptyTitle: {
    ...typography.headline,
    color: colors.label,
    textAlign: 'center',
  },
  retry: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 11,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  retryLabel: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.label,
  },
});
