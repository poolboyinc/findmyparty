import { StyleSheet, View } from 'react-native';
import { AuthHeader } from '@/components/ui/auth-header';
import { EmptyState } from '@/components/ui/empty-state';
import { colors } from '@/theme';

/**
 * Stub for the edit-profile flow. Backend doesn't have a profile-edit
 * endpoint yet — this screen exists so the Profile tab's "Edit Profile" row
 * has a destination that matches the eventual real screen's layout (header +
 * content area), instead of dead-ending with an Alert.
 *
 * TODO: replace `EmptyState` with the real form (name, email, avatar upload)
 * once `PATCH /api/users/me` exists.
 */
export default function EditProfilePage() {
  return (
    <View style={styles.root}>
      <AuthHeader title="Edit Profile" />
      <View style={styles.content}>
        <EmptyState
          sfSymbol="person.crop.circle"
          ionicon="person-circle-outline"
          title="Coming soon"
          body="You'll be able to edit your profile details here in a future update."
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
