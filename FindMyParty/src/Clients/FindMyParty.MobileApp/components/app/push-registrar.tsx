import { useEffect, useRef } from 'react';
import { router, useSegments, type Href } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useMe } from '@/hooks/queries';
import { rememberLink } from '@/services/pendingLink';
import { registerPushDevice } from '@/services/push';
import { pushRoute } from './push-route';

// A push that arrives while the app is open shows as a banner, except the scan: the flare
// (ScanMomentHost) is the app's own answer to that one.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const show = notification.request.content.data?.type !== 'scanned';
    return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
  },
});

/** Screens before the app proper: a tapped push waits until the user is through them. */
const BEFORE_APP = new Set(['splash', 'onboarding', 'login', 'register', 'forgot-password', 'reset-password', 'first-run']);

/** Pushes already acted on, so the launch response and the listener do not open the same screen twice. */
const handled = new Set<string>();

/**
 * Mounted once in app/_layout.tsx, inside the providers. Draws nothing.
 * - After each sign-in (and on launch when signed in) it sends this phone's push token to the account, if
 *   notifications are already allowed. It never asks: `askForPush()` in services/push.ts does, at the moments
 *   the spec names. Log out removes the token (authService.logout).
 * - A tapped push opens its screen (BUILD-3-SPEC §3.6). Tapped before the app is open (launch, sign-in, first
 *   run), the screen opens once the user reaches the tabs.
 */
export function PushRegistrar(): null {
  const { data: me } = useMe();
  const userId = me?.userId ?? null;
  const segments = useSegments();
  const where = segments[0] as string | undefined;
  const root = useRef<string | undefined>(where);
  useEffect(() => {
    root.current = where;
  }, [where]);

  useEffect(() => {
    if (userId) void registerPushDevice();
  }, [userId]);

  useEffect(() => {
    const open = (response: Notifications.NotificationResponse | null) => {
      if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const id = response.notification.request.identifier;
      if (handled.has(id)) return;
      handled.add(id);
      const route = pushRoute(response.notification.request.content.data);
      if (!route) return;
      const now = root.current;
      if (now === undefined || BEFORE_APP.has(now)) rememberLink(route);
      else router.push(route as Href);
    };

    try {
      // Opened by tapping a push while the app was closed.
      open(Notifications.getLastNotificationResponse());
    } catch {
      // No notification module in this build: nothing was tapped.
    }
    let subscription: { remove: () => void } | null = null;
    try {
      subscription = Notifications.addNotificationResponseReceivedListener(open);
    } catch {
      subscription = null;
    }
    return () => subscription?.remove();
  }, []);

  return null;
}
