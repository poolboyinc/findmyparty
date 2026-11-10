import { Alert, Linking, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { authService } from '@/services/authService';
import { queryClient } from '@/services/queryClient';
import { spacing } from '@/theme';
import { PlainRow } from './plain-row';

const SUPPORT_EMAIL = 'support@findmyparty.com';

/** The way out of the Live tab: the venue profile, support, the guest app, and signing out. */
export function AccountRows() {
  const openSupport = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {
      Alert.alert('No mail app', `Email ${SUPPORT_EMAIL} from any device.`);
    });
  };

  const signOut = () => {
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
            // Nothing this host loaded may be shown to whoever signs in next.
            queryClient.clear();
            router.replace('/admin/login');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.rows}>
      <PlainRow label="Venue profile" onPress={() => router.push('/admin/edit-profile')} />
      <PlainRow label="Help and support" onPress={openSupport} />
      <PlainRow label="Back to the guest app" onPress={() => router.replace('/(tabs)')} />
      <PlainRow label="Sign out" onPress={signOut} destructive />
    </View>
  );
}

const styles = StyleSheet.create({
  rows: {
    marginTop: spacing.xl,
  },
});
