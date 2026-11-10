import { useEffect, useRef, useState } from 'react';
import { usePass } from '@/hooks/queries';
import type { Pass } from '@/types/api';
import { loadAllPasses, loadPass, savePass } from './passStore';

/**
 * How recently the pass must have been checked for a higher count to be "the door just scanned it".
 * Longer than that and the scan happened while nobody was looking, so the moment (and its time) would be wrong.
 */
const SCAN_WATCH_MS = 60_000;

/**
 * A booking's pass: fresh from the server when there is signal, otherwise the copy saved on the phone.
 * `onScanned` fires when the door lets more guests in while this pass is being watched. Never on first load.
 */
export function usePassData(bookingId: string, watch: boolean, onScanned: (pass: Pass) => void) {
  const query = usePass(bookingId, { watch });
  const live = query.data;
  const updatedAt = query.dataUpdatedAt;

  const [saved, setSaved] = useState<{ bookingId: string; pass: Pass | null } | null>(null);

  useEffect(() => {
    let alive = true;
    loadPass(bookingId).then((pass) => {
      if (alive) setSaved({ bookingId, pass });
    });
    return () => {
      alive = false;
    };
  }, [bookingId]);

  // After each successful fetch, keep a copy for the door.
  useEffect(() => {
    if (live) void savePass(live);
  }, [live]);

  const seen = useRef<{ count: number; at: number } | null>(null);
  useEffect(() => {
    if (!live) return;
    const previous = seen.current;
    seen.current = { count: live.checkedInCount, at: updatedAt };
    if (watch && previous && live.checkedInCount > previous.count && updatedAt - previous.at <= SCAN_WATCH_MS) {
      onScanned(live);
    }
  }, [live, updatedAt, watch, onScanned]);

  const savedChecked = saved?.bookingId === bookingId;
  const pass = live ?? (savedChecked ? saved.pass : null);

  return {
    pass,
    /** Nothing to draw yet, and still looking. */
    isLoading: !pass && (query.isPending || !savedChecked),
    /** Set only when there is no pass to draw at all. */
    error: !pass && savedChecked && query.isError ? query.error : null,
    refetch: query.refetch,
  };
}

/** Every pass saved on the phone, or null while reading. Only reads when `enabled`. */
export function useSavedPasses(enabled: boolean): Pass[] | null {
  const [passes, setPasses] = useState<Pass[] | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    loadAllPasses().then((all) => {
      if (alive) setPasses(all);
    });
    return () => {
      alive = false;
    };
  }, [enabled]);

  return passes;
}
