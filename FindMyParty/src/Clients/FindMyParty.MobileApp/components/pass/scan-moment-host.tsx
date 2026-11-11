import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { keys } from '@/hooks/queries';
import { flareFromPush, type FlareRequest } from './flare';
import { flareGate, listenForFlares, loadFlared, saveFlared } from './flare-bus';
import { ScanMoment } from './scan-moment';

type Subscription = { remove: () => void };

/**
 * Mounted once in app/_layout.tsx, after the navigator and inside the providers, so the flare covers
 * every screen. Shows the scan flare (S-15) when:
 * - a `scanned` push arrives while the app is open,
 * - a `scanned` push is tapped (PushRegistrar opens the Pass tab underneath; see components/app/push-route.ts),
 * - the Pass tab's poll sees the door count rise (`requestFlare` in flare-bus.ts).
 * Once per booking on this phone, whichever comes first.
 *
 * `expo-notifications` is loaded on demand: a build without its native module keeps the poll path.
 */
export function ScanMomentHost() {
  const client = useQueryClient();
  const [current, setCurrent] = useState<FlareRequest | null>(null);
  const queue = useRef<FlareRequest[]>([]);

  const show = useCallback(
    (request: FlareRequest) => {
      void loadFlared().then(() => {
        // Already seen on this phone.
        if (!flareGate.admit(request.bookingId)) return;
        saveFlared();
        // The push brought the award: no need to ask for it.
        if (request.award) client.setQueryData(keys.award(request.bookingId), request.award);
        // Everything a scan changes.
        void client.invalidateQueries({ queryKey: keys.bookings });
        void client.invalidateQueries({ queryKey: keys.pass(request.bookingId) });
        void client.invalidateQueries({ queryKey: keys.glow });
        void client.invalidateQueries({ queryKey: keys.nights });
        void client.invalidateQueries({ queryKey: keys.profile });
        setCurrent((showing) => {
          if (showing) {
            queue.current.push(request);
            return showing;
          }
          return request;
        });
      });
    },
    [client],
  );

  // The Pass tab's poll.
  useEffect(() => listenForFlares(show), [show]);

  // Pushes: arriving in the foreground, tapped, and the one that opened the app.
  useEffect(() => {
    let stopped = false;
    const subscriptions: Subscription[] = [];

    const start = async () => {
      try {
        const Notifications = await import('expo-notifications');
        if (stopped) return;
        subscriptions.push(
          Notifications.addNotificationReceivedListener((notification) => {
            const request = flareFromPush(notification.request.content.data, false, Date.now());
            if (request) show(request);
          }),
          Notifications.addNotificationResponseReceivedListener((response) => {
            const request = flareFromPush(response.notification.request.content.data, true, Date.now());
            if (request) show(request);
          }),
        );
        const opened = await Notifications.getLastNotificationResponseAsync();
        if (stopped || !opened) return;
        const request = flareFromPush(opened.notification.request.content.data, true, Date.now());
        if (request) show(request);
      } catch {
        // No push module in this build, or no permission: the Pass tab's poll still shows the flare.
      }
    };
    void start();

    return () => {
      stopped = true;
      subscriptions.forEach((subscription) => {
        try {
          subscription.remove();
        } catch {
          // Already gone.
        }
      });
    };
  }, [show]);

  const onDone = useCallback(() => {
    setCurrent(queue.current.shift() ?? null);
  }, []);

  return current ? <ScanMoment key={current.bookingId} request={current} onDone={onDone} /> : null;
}
