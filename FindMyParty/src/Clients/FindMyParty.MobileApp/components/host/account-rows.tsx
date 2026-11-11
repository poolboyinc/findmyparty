import { Alert, Linking, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { routes } from '@/constants/routes';
import { authService } from '@/services/authService';
import { queryClient } from '@/services/queryClient';
import { spacing } from '@/theme';
import { PlainRow } from './plain-row';

const SUPPORT_EMAIL = 'support@findmyparty.com';

/** Signs out and forgets everything this account loaded, then goes to the host sign-in. */
export function confirmSignOut() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  Alert.alert('Sign out?', 'You will need to sign in again.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Sign out',
      style: 'destructive',
      onPress: async () => {
        try {
          await authService.logout();
        } finally {
          // Nothing this account loaded may be shown to whoever signs in next.
          queryClient.clear();
          router.replace('/admin/login');
        }
      },
    },
  ]);
}

type Props = {
  /** The platform admin also gets "Platform review". */
  admin?: boolean;
};

/** The bottom of the Venue tab: support, the guest app, signing out, and for an admin the review screen. */
export function AccountRows({ admin = false }: Props) {
  const openSupport = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {
      Alert.alert('No mail app', `Email ${SUPPORT_EMAIL} from any device.`);
    });
  };

  return (
    <View style={styles.rows}>
      {admin ? <PlainRow label="Platform review" onPress={() => router.push(routes.review)} /> : null}
      <PlainRow label="Help and support" onPress={openSupport} />
      <PlainRow label="Back to the guest app" onPress={() => router.replace('/(tabs)')} />
      <PlainRow label="Sign out" onPress={confirmSignOut} destructive />
    </View>
  );
}

const styles = StyleSheet.create({
  rows: {
    marginTop: spacing.xl,
  },
});
