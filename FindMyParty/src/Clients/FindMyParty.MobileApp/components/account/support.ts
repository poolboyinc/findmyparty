import { Alert, Linking } from 'react-native';

export const SUPPORT_EMAIL = 'support@findmyparty.com';

/** Opens the mail app with a message to support. With no mail app set up, shows the address instead. */
export function emailSupport(subject?: string): void {
  const query = subject ? `?subject=${encodeURIComponent(subject)}` : '';
  Linking.openURL(`mailto:${SUPPORT_EMAIL}${query}`).catch(() => {
    Alert.alert('No mail app', `Write to ${SUPPORT_EMAIL} from any device.`);
  });
}
