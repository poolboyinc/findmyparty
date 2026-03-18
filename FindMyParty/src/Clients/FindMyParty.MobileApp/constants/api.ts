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
