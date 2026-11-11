import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import type * as NotificationsTypes from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from './apiClient';
import { PUSH_TOKEN_KEY } from './authService';
import { deviceModule, notificationsModule } from './nativeModules';

// Push notifications (BUILD-3-SPEC §3.3 "Push", §2.6). The app never asks on launch: `askForPush()` asks
// once, at the first of a pass taken, a venue followed, or "Show me on friends' maps" switched on.
// A "no", a simulator, a build without a project id or no signal: nothing happens and nothing is said.
// Unregistering on log out is in authService.logout (it has to run while the session still works).

/** AsyncStorage key set to "1" once this phone has shown the system's notification prompt. */
const PUSH_ASKED_KEY = '@findmyparty/push-asked';

/** The EAS project the Expo push token belongs to, or null in a build that has none. */
function projectId(): string | null {
  const extra: unknown = Constants.expoConfig?.extra?.eas?.projectId;
  const id = typeof extra === 'string' && extra ? extra : Constants.easConfig?.projectId;
  return typeof id === 'string' && id ? id : null;
}

/** Push needs a real phone and a project to send through. */
function canPush(): boolean {
  return deviceModule()?.isDevice === true && notificationsModule() !== null && projectId() !== null;
}

function allowed(Notifications: typeof NotificationsTypes, permission: NotificationsTypes.NotificationPermissionsStatus): boolean {
  return permission.granted || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

/** Android shows nothing without a channel; it must exist before the prompt on Android 13 and later. */
async function ensureChannel(Notifications: typeof NotificationsTypes): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'FindMyParty',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

let registering: Promise<void> | null = null;

/**
 * Sends this phone's Expo push token to the signed-in account (`PUT /api/me/devices`) when notifications are
 * already allowed. Never asks and never rejects. Called by `askForPush()` after a yes, and by `PushRegistrar`
 * after each sign-in and launch, so the token follows whoever is signed in on this phone.
 */
export function registerPushDevice(): Promise<void> {
  registering ??= (async () => {
    try {
      const id = projectId();
      const Notifications = notificationsModule();
      if (!canPush() || !id || !Notifications) return;
      if (!allowed(Notifications, await Notifications.getPermissionsAsync())) return;
      await ensureChannel(Notifications);
      const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId: id });
      if (!expoPushToken) return;
      await api.request<void>('/api/me/devices', {
        method: 'PUT',
        body: { expoPushToken, platform: Platform.OS === 'ios' ? 'ios' : 'android' },
      });
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, expoPushToken);
    } catch {
      // Signed out, no signal, or the push service did not answer: tried again on the next launch.
    }
  })().finally(() => {
    registering = null;
  });
  return registering;
}

let asking: Promise<void> | null = null;

/**
 * Asks for permission to send notifications, once, and registers this phone when the answer is yes.
 * Call it at the first of: a pass is taken, a venue is followed, "Show me on friends' maps" is switched on.
 * Never rejects: with no permission, no token or on a simulator it does nothing. Safe to call every time
 * (after the first time it only makes sure the phone is registered).
 */
export function askForPush(): Promise<void> {
  asking ??= (async () => {
    try {
      const Notifications = notificationsModule();
      if (!canPush() || !Notifications) return;
      const current = await Notifications.getPermissionsAsync();
      if (!allowed(Notifications, current)) {
        // Asked before, or the phone says no for good: stay quiet.
        if (!current.canAskAgain) return;
        if ((await AsyncStorage.getItem(PUSH_ASKED_KEY)) === '1') return;
        await AsyncStorage.setItem(PUSH_ASKED_KEY, '1');
        await ensureChannel(Notifications);
        if (!allowed(Notifications, await Notifications.requestPermissionsAsync())) return;
      }
      await registerPushDevice();
    } catch {
      // The notification module did not answer: nothing to say about it.
    }
  })().finally(() => {
    asking = null;
  });
  return asking;
}
