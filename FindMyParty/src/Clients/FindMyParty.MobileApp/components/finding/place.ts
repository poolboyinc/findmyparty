import { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import * as Location from 'expo-location';

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

/** The area around a point in words ("Stara Varoš, Podgorica"), or null while unknown. Never raw coordinates. */
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
        const words = [area, city].filter((part, i, all) => !!part && all.indexOf(part) === i).join(', ');
        setLabel(words.length > 0 ? words : null);
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
