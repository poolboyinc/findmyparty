import { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import { distanceText, metresBetween } from './format';

/** Opens the place in Apple Maps (the platform's maps app elsewhere). */
export function openInMaps(latitude: number, longitude: number, name?: string | null): void {
  const label = encodeURIComponent(name ?? 'Party');
  const url =
    Platform.OS === 'ios'
      ? `https://maps.apple.com/?ll=${latitude},${longitude}&q=${label}`
      : `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`;
  Linking.openURL(url).catch(() => {
    // No maps app to hand over to. Nothing useful to tell the guest.
  });
}

/** The area around a point in words ("Stara Varoš", else the city), or null while unknown. Never raw coordinates. */
export function useAreaLabel(latitude: number | undefined, longitude: number | undefined): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (latitude === undefined || longitude === undefined) return;
    let cancelled = false;
    (async () => {
      try {
        const [first] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (cancelled) return;
        const area = first?.district ?? first?.subregion ?? null;
        const city = first?.city ?? first?.region ?? null;
        setLabel(area ?? city);
      } catch {
        if (!cancelled) setLabel(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);

  return label;
}

/** Phone fixes older than this are too stale to say how far away something is. */
const POSITION_MAX_AGE_MS = 10 * 60_000;

/**
 * How far the place is from the phone ("550 m, 7 min walk"), or null when unknown. Never asks for location:
 * it only answers when the user already allowed it (on the map or in first run), from the last known fix.
 */
export function useDistanceText(latitude: number | undefined, longitude: number | undefined): string | null {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    // 0,0 is what a party without a place comes back as.
    if (latitude === undefined || longitude === undefined || (latitude === 0 && longitude === 0)) return;
    let cancelled = false;
    (async () => {
      try {
        const { granted } = await Location.getForegroundPermissionsAsync();
        if (!granted || cancelled) return;
        const fix = await Location.getLastKnownPositionAsync({ maxAge: POSITION_MAX_AGE_MS });
        if (!fix || cancelled) return;
        const words = distanceText(metresBetween(fix.coords, { latitude, longitude }));
        setText(words || null);
      } catch {
        if (!cancelled) setText(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);

  return text;
}
