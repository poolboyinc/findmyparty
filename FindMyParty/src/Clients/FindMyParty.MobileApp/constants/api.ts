import { Platform } from 'react-native';

const DEV_HOST = Platform.OS === 'android'
  ? '10.0.2.2'
  : (process.env.EXPO_PUBLIC_DEV_HOST ?? '192.168.1.66');

export const ApiConstants = {
  MapboxPublicToken: process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '',

  // All traffic goes through the YARP gateway
  GatewayBaseUrl: __DEV__
    ? `http://${DEV_HOST}:5000`
    : 'https://api.findmyparty.com',
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
