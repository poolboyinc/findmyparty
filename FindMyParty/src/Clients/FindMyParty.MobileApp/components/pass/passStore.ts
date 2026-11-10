// A copy of each pass kept on the phone, so the door code still shows with no signal.
// Every call swallows storage errors: a failed save must never break the Pass.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Pass } from '@/types/api';

/** `@findmyparty/pass/<bookingId>` */
export const PASS_KEY_PREFIX = '@findmyparty/pass/';

export const passKey = (bookingId: string) => `${PASS_KEY_PREFIX}${bookingId}`;

function parse(raw: string | null | undefined): Pass | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Pass> | null;
    if (!value || typeof value.bookingId !== 'string' || typeof value.secret !== 'string') return null;
    return value as Pass;
  } catch {
    return null;
  }
}

/** Keeps the latest pass. A cancelled pass is removed instead. */
export async function savePass(pass: Pass): Promise<void> {
  try {
    if (pass.status === 'Cancelled') await AsyncStorage.removeItem(passKey(pass.bookingId));
    else await AsyncStorage.setItem(passKey(pass.bookingId), JSON.stringify(pass));
  } catch {
    // Nothing to do: the pass on screen is unaffected.
  }
}

export async function loadPass(bookingId: string): Promise<Pass | null> {
  try {
    const pass = parse(await AsyncStorage.getItem(passKey(bookingId)));
    return pass && pass.bookingId === bookingId ? pass : null;
  } catch {
    return null;
  }
}

export async function removePasses(bookingIds: readonly string[]): Promise<void> {
  if (bookingIds.length === 0) return;
  try {
    await AsyncStorage.multiRemove(bookingIds.map(passKey));
  } catch {
    // A stale copy is harmless: it is ignored once its party has ended.
  }
}

/** Every pass saved on this phone. For showing a pass when the bookings cannot be loaded at all. */
export async function loadAllPasses(): Promise<Pass[]> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(PASS_KEY_PREFIX));
    if (keys.length === 0) return [];
    const pairs = await AsyncStorage.multiGet(keys);
    return pairs.map(([, raw]) => parse(raw)).filter((pass): pass is Pass => pass !== null);
  } catch {
    return [];
  }
}
