import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlatButton } from '@/components/account/provider-button';
import { Failed, Loading } from '@/components/afterglow/state';
import { AuthField } from '@/components/ui/auth-field';
import { AuthHeader } from '@/components/ui/auth-header';
import { useProfile, useUpdateProfile } from '@/hooks/queries';
import { errorText } from '@/services/errorText';
import { colors, layout, spacing, typography } from '@/theme';

/** The server takes a display name of 1 to 40 characters (`name_invalid`). */
const MAX_NAME = 40;

/** Edit profile, from settings: the display name friends, the pass and the door see. */
export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const profile = useProfile();
  const update = useUpdateProfile();
  const [name, setName] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // The field starts from the account once it has loaded, and is the user's from then on.
  const loaded = profile.data?.displayName;
  useEffect(() => {
    if (loaded !== undefined) setName((current) => current ?? loaded);
  }, [loaded]);

  const value = name ?? '';
  const trimmed = value.trim();
  const valid = trimmed.length >= 1 && trimmed.length <= MAX_NAME;
  const fieldError = submitted && !valid ? 'A name is 1 to 40 characters.' : null;
  const unchanged = trimmed === (loaded ?? '').trim();

  const save = () => {
    setSubmitted(true);
    if (!valid || update.isPending) return;
    if (unchanged) {
      router.back();
      return;
    }
    update.mutate(
      { displayName: trimmed },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        },
        onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
      },
    );
  };

  return (
    <View style={styles.root}>
      <AuthHeader title="Edit profile" disabled={update.isPending} />
      {profile.data ? (
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.label}>Display name</Text>
            <AuthField
              placeholder="Your name"
              value={value}
              onChangeText={setName}
              autoCapitalize="words"
              autoCorrect={false}
              textContentType="name"
              autoComplete="name"
              returnKeyType="done"
              onSubmitEditing={save}
              maxLength={MAX_NAME}
              accessibilityLabel="Display name"
              helper="Friends see it, and the door sees it on your pass."
              error={fieldError}
              editable={!update.isPending}
            />
            <Text style={styles.handle}>{`@${profile.data.handle}`}</Text>

            {update.isError ? (
              <Text style={styles.formError} accessibilityRole="alert" accessibilityLiveRegion="polite">
                {errorText(update.error)}
              </Text>
            ) : null}

            <View style={styles.button}>
              <FlatButton tone="action" label="Save" onPress={save} loading={update.isPending} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : profile.isError ? (
        <Failed error={profile.error} onRetry={() => profile.refetch()} />
      ) : (
        <Loading />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  fill: {
    flex: 1,
  },
  content: {
    paddingHorizontal: layout.screenMargin,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  label: {
    ...typography.subheadline,
    fontWeight: '600',
    color: colors.labelSecondary,
  },
  handle: {
    ...typography.footnote,
    color: colors.labelTertiary,
    paddingHorizontal: spacing.xs,
  },
  formError: {
    ...typography.subheadline,
    color: colors.danger,
  },
  button: {
    marginTop: spacing.lg,
  },
});
