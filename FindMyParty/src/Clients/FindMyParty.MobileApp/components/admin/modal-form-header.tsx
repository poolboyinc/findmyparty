import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, spacing, typography, weights } from '@/theme';

type Props = {
  /** Centered modal title, e.g. "New Party" or "Edit Party". */
  title: string;
  onCancel: () => void;
  onPost: () => void;
  /** Disables both actions and swaps the right label for a spinner. */
  submitting: boolean;
  /** Right-action label. Defaults to "Post" (Create); pass "Save" for Edit. */
  postLabel?: string;
};

/**
 * Modal-style header for the host create/edit flows: a left "Cancel" ghost, a
 * centered title, and a right tinted text action. Mirrors the iOS
 * navigation-bar modal pattern rather than the app's circular `AuthHeader`.
 *
 * Usage:
 *   <ModalFormHeader title="New Party" onCancel={…} onPost={…} submitting={loading} />
 *   <ModalFormHeader title="Edit Party" postLabel="Save" onCancel={…} onPost={…} submitting={loading} />
 */
export function ModalFormHeader({ title, onCancel, onPost, submitting, postLabel = 'Post' }: Props) {
  const insets = useSafeAreaInsets();

  const handleCancel = () => {
    if (submitting) return;
    Haptics.selectionAsync();
    onCancel();
  };

  const handlePost = () => {
    if (submitting) return;
    Haptics.selectionAsync();
    onPost();
  };

  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing.sm }]}>
      <Pressable
        onPress={handleCancel}
        disabled={submitting}
        hitSlop={layout.hitSlop}
        accessibilityRole="button"
        accessibilityLabel="Cancel"
        accessibilityHint="Discards this party and closes the screen"
        accessibilityState={{ disabled: submitting }}
        style={({ pressed }) => [
          styles.side,
          styles.sideLeft,
          pressed && !submitting && styles.pressed,
          submitting && styles.disabled,
        ]}
      >
        <Text style={styles.cancelLabel}>Cancel</Text>
      </Pressable>

      <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
        {title}
      </Text>

      <Pressable
        onPress={handlePost}
        disabled={submitting}
        hitSlop={layout.hitSlop}
        accessibilityRole="button"
        accessibilityLabel={postLabel}
        accessibilityHint="Saves your party"
        accessibilityState={{ disabled: submitting, busy: submitting }}
        style={({ pressed }) => [
          styles.side,
          styles.sideRight,
          pressed && !submitting && styles.pressed,
        ]}
      >
        {submitting ? (
          <ActivityIndicator color={colors.tint} />
        ) : (
          <Text style={styles.postLabel}>{postLabel}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    backgroundColor: colors.bg,
  },
  side: {
    minWidth: 64,
    height: layout.minTouchTarget,
    justifyContent: 'center',
  },
  sideLeft: {
    alignItems: 'flex-start',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.4,
  },
  title: {
    ...typography.headline,
    color: colors.label,
    textAlign: 'center',
  },
  cancelLabel: {
    ...typography.body,
    color: colors.labelSecondary,
  },
  postLabel: {
    ...typography.body,
    fontWeight: weights.semibold,
    color: colors.tint,
  },
});
