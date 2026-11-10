import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { authService } from '@/services/authService';

/**
 * Only a Host or Admin gets into the host tabs. Returns false until the role is confirmed, so a
 * screen can hold its first paint (and its host requests) until then. No session, or a session that
 * cannot be read, goes to the host sign-in; a guest account is told why and sent there too.
 */
export function useHostGate(): boolean {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const toSignIn = () => router.replace('/admin/login');

    authService
      .getUserInfo()
      .then((info) => {
        if (cancelled) return;
        if (!info) {
          toSignIn();
          return;
        }
        const roles = info.roles ?? [];
        if (!roles.includes('Host') && !roles.includes('Admin')) {
          Alert.alert('Access denied', 'You need a host account to use the host area.', [
            { text: 'Go back', onPress: toSignIn },
          ]);
          return;
        }
        setAllowed(true);
      })
      .catch(() => {
        if (!cancelled) toSignIn();
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return allowed;
}
