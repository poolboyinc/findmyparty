import { useCallback, useMemo } from 'react';
import * as Haptics from 'expo-haptics';
import { useSaved, useToggleSaved } from './queries';

export type SavedKind = 'party' | 'venue';

export interface SavedItems {
  /** The heart is on. False until the saved list has loaded. */
  isSaved: (kind: SavedKind, id: string) => boolean;
  /** Turns the heart on or off. The heart changes at once and goes back if the server says no. */
  toggle: (kind: SavedKind, id: string) => void;
  /** The saved list has loaded (also when it failed). */
  loaded: boolean;
}

/**
 * The parties and venues the user saved with a heart, on the account (`GET /api/me/saved`).
 * Every heart in the app uses this: the Tonight card, the party and venue pages, the map's venue sheet, Saved.
 * (`useSaved()` in hooks/queries.ts is the raw query underneath.)
 */
export function useSavedItems(): SavedItems {
  const { data, isPending } = useSaved();
  const { mutate } = useToggleSaved();

  const sets = useMemo(
    () => ({ party: new Set(data?.parties ?? []), venue: new Set(data?.venues ?? []) }),
    [data],
  );

  const isSaved = useCallback((kind: SavedKind, id: string) => sets[kind].has(id), [sets]);

  const toggle = useCallback(
    (kind: SavedKind, id: string) => {
      mutate(
        { kind, id, saved: !sets[kind].has(id) },
        {
          // The heart has already gone back; a short buzz says it did not take.
          onError: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
        },
      );
    },
    [mutate, sets],
  );

  return { isSaved, toggle, loaded: !isPending };
}
