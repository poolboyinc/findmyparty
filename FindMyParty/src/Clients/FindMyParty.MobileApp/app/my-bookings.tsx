import { Redirect } from 'expo-router';

/** The old tickets screen. Passes live on the Pass tab now; this keeps old links working. */
export default function MyBookingsRedirect() {
  return <Redirect href="/(tabs)/pass" />;
}
