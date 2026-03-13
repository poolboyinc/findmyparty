import { Platform } from 'react-native';

const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

export const ApiConstants = {
  MapboxPublicToken:
    'pk.eyJ1IjoicG9vbGJvaWluYyIsImEiOiJjbTl0eWhuNHkwM3l0Mm1zOXBqc2FxMDVkIn0.ARL02yHrAorx0t98mlv2KQ',

  // All traffic goes through the YARP gateway
  GatewayBaseUrl: __DEV__
    ? `http://${DEV_HOST}:5000`
    : 'https://api.findmyparty.com',
};
