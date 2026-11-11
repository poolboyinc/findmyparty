// How the Pass tab tells the root's ScanMomentHost that the door just scanned a pass. The push path
// does not use this: the host listens to notifications itself.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createFlareGate, type FlareRequest } from './flare';

/** `@findmyparty/flared`: the bookings that already had their flare on this phone (JSON array, newest last). */
export const FLARED_KEY = '@findmyparty/flared';

type Listener = (request: FlareRequest) => void;

let listener: Listener | null = null;
/** Asks that came before the host was listening (it mounts after the first screen). */
let waiting: FlareRequest[] = [];

/** Asks for the flare. Shown once per booking, whoever asks first. */
export function requestFlare(request: FlareRequest): void {
  if (listener) listener(request);
  else waiting = [...waiting, request];
}

/** For ScanMomentHost only: receives every ask, including those made before it listened. */
export function listenForFlares(next: Listener): () => void {
  listener = next;
  const early = waiting;
  waiting = [];
  early.forEach(next);
  return () => {
    if (listener === next) listener = null;
  };
}

/** The phone-wide "one flare per booking" gate. Reads the remembered list once; storage errors are ignored. */
export const flareGate = createFlareGate();

let loaded: Promise<void> | null = null;

export function loadFlared(): Promise<void> {
  loaded ??= AsyncStorage.getItem(FLARED_KEY)
    .then((raw) => {
      const ids: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(ids)) flareGate.merge(ids.filter((id): id is string => typeof id === 'string'));
    })
    .catch(() => {});
  return loaded;
}

export function saveFlared(): void {
  AsyncStorage.setItem(FLARED_KEY, JSON.stringify(flareGate.seen())).catch(() => {});
}
