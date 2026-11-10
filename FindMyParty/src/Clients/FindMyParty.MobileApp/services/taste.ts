import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

// Music taste and the first-run flag. Both live on this phone only: the server has no place for them yet.

/** AsyncStorage key for the genres the user picked on first run, in pick order (JSON array of strings). */
export const TASTE_KEY = '@findmyparty/taste';
/** AsyncStorage key set to "1" once the first-run steps (taste, location) have been seen on this phone. */
export const FIRST_RUN_DONE_KEY = '@findmyparty/first-run-done';

/** The picked genres in pick order, or [] when none were picked or the store cannot be read. */
export async function getTaste(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(TASTE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((genre): genre is string => typeof genre === 'string');
  } catch {
    return [];
  }
}

/** Saves the picked genres, in pick order. Duplicates are dropped. */
export async function setTaste(genres: string[]): Promise<void> {
  await AsyncStorage.setItem(TASTE_KEY, JSON.stringify([...new Set(genres)]));
}

/** The saved taste, read again each time the screen comes into focus. `loaded` is false until the first read ends. */
export function useTaste(): { taste: string[]; loaded: boolean } {
  const [state, setState] = useState<{ taste: string[]; loaded: boolean }>({ taste: [], loaded: false });

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getTaste().then((taste) => {
        if (!cancelled) setState({ taste, loaded: true });
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return state;
}

/** True once first run was finished on this phone. A store that cannot be read counts as finished, so nobody gets stuck. */
export async function hasFinishedFirstRun(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(FIRST_RUN_DONE_KEY)) === '1';
  } catch {
    return true;
  }
}

/** Remembers that first run is done on this phone. Not cleared on log out: it belongs to the phone, not the account. */
export async function markFirstRunDone(): Promise<void> {
  await AsyncStorage.setItem(FIRST_RUN_DONE_KEY, '1');
}
