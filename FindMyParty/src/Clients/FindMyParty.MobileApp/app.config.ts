import { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'FindMyParty',
  slug: config.slug ?? 'findmyparty',
  ios: {
    ...config.ios,
    infoPlist: {
      ...((config.ios?.infoPlist as Record<string, unknown>) ?? {}),
      CFBundleURLTypes: [
        {
          CFBundleURLSchemes: [
            process.env.EXPO_PUBLIC_GOOGLE_REVERSED_CLIENT_ID ?? '',
          ],
        },
      ],
    },
  },
});
