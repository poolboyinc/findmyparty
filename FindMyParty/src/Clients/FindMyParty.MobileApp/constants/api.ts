import { Platform } from 'react-native';

const DEV_HOST = Platform.OS === 'android'
  ? '10.0.2.2'
  : (process.env.EXPO_PUBLIC_DEV_HOST ?? '192.168.1.66');

// If EXPO_PUBLIC_API_URL is set, always use it (even in dev) — lets the dev
// client hit Railway instead of a local gateway. Fall back to local for
// offline/local backend work.
const REMOTE_API = process.env.EXPO_PUBLIC_API_URL;

export const ApiConstants = {
  MapboxPublicToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '',

  GatewayBaseUrl: REMOTE_API
    ? REMOTE_API
    : (__DEV__ ? `http://${DEV_HOST}:5000` : 'https://api.findmyparty.com'),
};

/**
 * Rewrites localhost media URLs returned by backend services to use the
 * actual dev host IP so the phone/emulator can reach them.
 * In production, URLs are already absolute and pass through unchanged.
 */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!__DEV__) return url;
  return url.replace(/http:\/\/localhost(:\d+)?/g, (_, port) => `http://${DEV_HOST}${port ?? ''}`);
}
