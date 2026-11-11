// Native libraries that a build may not contain yet. A development build made before a library was added
// does not have its native half, and importing such a library throws the moment the file is loaded, which
// takes the whole screen down with it. These load the library when first needed instead, and give null when
// the build lacks it, so only that one feature goes quiet.

type NotificationsModule = typeof import('expo-notifications');
type DeviceModule = typeof import('expo-device');
type ClipboardModule = typeof import('expo-clipboard');

function optional<T>(load: () => T): () => T | null {
  let loaded: { module: T | null } | null = null;
  return () => {
    if (!loaded) {
      try {
        loaded = { module: load() };
      } catch {
        loaded = { module: null };
      }
    }
    return loaded.module;
  };
}

/* eslint-disable @typescript-eslint/no-require-imports -- a require inside try is the only way to survive a missing native module */
export const notificationsModule = optional<NotificationsModule>(() => require('expo-notifications'));
export const deviceModule = optional<DeviceModule>(() => require('expo-device'));
export const clipboardModule = optional<ClipboardModule>(() => require('expo-clipboard'));
/* eslint-enable @typescript-eslint/no-require-imports */
