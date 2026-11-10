import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Linking } from 'react-native';
import * as Location from 'expo-location';
import type { LngLat } from '@/components/city/constants';

/** `checking` only until the first look at the system setting has come back. */
export type LocationPermission = 'checking' | 'undetermined' | 'granted' | 'denied';

/** How long to wait for a fresh fix before settling for the last known position. */
const FIX_TIMEOUT_MS = 8000;

// "Not now" on the location card is remembered until the app is closed, also across
// leaving and coming back to the tab. Deliberately not stored: next launch may ask again.
let declinedThisSession = false;

function toPermission(status: Location.PermissionStatus): LocationPermission {
  if (status === Location.PermissionStatus.GRANTED) return 'granted';
  if (status === Location.PermissionStatus.DENIED) return 'denied';
  return 'undetermined';
}

function toLngLat(position: Location.LocationObject | null): LngLat | null {
  if (!position) return null;
  const { longitude, latitude } = position.coords;
  return Number.isFinite(longitude) && Number.isFinite(latitude) ? [longitude, latitude] : null;
}

/**
 * Location for the city map. Nothing here shows the system prompt by itself: mounting only
 * reads the current setting, and `request` is called from the "Use my location" button.
 * Every call into the location module is wrapped: a failure ends as "no position" or
 * "not granted", never as a thrown error, so the map and its venues are unaffected.
 */
export function useCityLocation() {
  const [permission, setPermission] = useState<LocationPermission>('checking');
  const [declined, setDeclined] = useState(declinedThisSession);

  const check = useCallback(async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      setPermission(toPermission(status));
    } catch {
      // Cannot tell. Treat it as not asked yet; asking is itself guarded below.
      setPermission((current) => (current === 'checking' ? 'undetermined' : current));
    }
  }, []);

  // Read the setting on mount, and again whenever the app returns to the front
  // (the user may have just changed it in Settings).
  useEffect(() => {
    check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => subscription.remove();
  }, [check]);

  /** Shows the system prompt. Call only from a button the user pressed. */
  const request = useCallback(async (): Promise<LocationPermission> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const next = toPermission(status);
      setPermission(next);
      return next;
    } catch {
      setPermission('denied');
      return 'denied';
    }
  }, []);

  /** "Not now": stop offering for this session. */
  const decline = useCallback(() => {
    declinedThisSession = true;
    setDeclined(true);
  }, []);

  /** Offer again, because the user asked for something that needs location. */
  const offerAgain = useCallback(() => {
    declinedThisSession = false;
    setDeclined(false);
  }, []);

  /**
   * Where the user is right now: a fresh fix if one arrives in time, else the last known
   * position, else null. Never throws.
   */
  const getPosition = useCallback(async (): Promise<LngLat | null> => {
    try {
      const fresh = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), FIX_TIMEOUT_MS));
      const position = toLngLat(await Promise.race([fresh, timeout]));
      if (position) return position;
    } catch {
      // Fall through to the last known position.
    }
    try {
      return toLngLat(await Location.getLastKnownPositionAsync());
    } catch {
      return null;
    }
  }, []);

  const openSettings = useCallback(() => {
    Linking.openSettings().catch(() => {});
  }, []);

  return useMemo(
    () => ({
      permission,
      /** Show the "Turn the lights on" card: not asked yet, and not waved away this session. */
      shouldOffer: permission === 'undetermined' && !declined,
      request,
      decline,
      offerAgain,
      getPosition,
      openSettings,
    }),
    [permission, declined, request, decline, offerAgain, getPosition, openSettings],
  );
}

export type CityLocation = ReturnType<typeof useCityLocation>;
