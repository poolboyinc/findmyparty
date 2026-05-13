import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FAVORITE_IDS_KEY } from '@/constants/cities';

// TODO: wire to backend when /api/favorites endpoints exist.
// Today this is local-only:
//   POST   /api/favorites           → toggle()
//   DELETE /api/favorites/:id       → toggle()
//   GET    /api/favorites           → loadFromBackend() on mount
// Until then we persist to AsyncStorage and accept that favorites don't sync
// across devices.

/**
 * Manages the user's favorite party IDs. Reads from AsyncStorage on mount,
 * writes on every change. MVP-only: no backend sync, no cross-device sync,
 * no auth-gated server persistence.
 *
 * Writes are serialized through an in-flight promise queue — rapid toggles
 * (favorite → unfavorite → favorite) chain in order so the persisted value
 * always reflects the latest state instead of racing.
 */
export function useFavorites() {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  // Single-slot write queue. Each persist() call chains onto the previous
  // promise so AsyncStorage.setItem invocations run serially.
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(FAVORITE_IDS_KEY);
        if (cancelled) return;
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setIds(new Set(parsed.filter((v): v is string => typeof v === 'string')));
          }
        }
      } catch {
        // Corrupted or missing — start fresh.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((next: Set<string>) => {
    // Chain onto the queue. `.catch` swallows individual failures so one bad
    // write doesn't break subsequent writes in the chain.
    writeQueueRef.current = writeQueueRef.current
      .then(() => AsyncStorage.setItem(FAVORITE_IDS_KEY, JSON.stringify([...next])))
      .catch(() => {
        // Storage failures aren't user-fixable; favorites just won't survive restart.
      });
  }, []);

  const isFavorite = useCallback((id: string) => ids.has(id), [ids]);

  const toggle = useCallback(
    (id: string) => {
      setIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  return { isFavorite, toggle, loaded, count: ids.size };
}
