import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useCheckInBatch } from '@/hooks/queries';
import {
  DOOR_QUEUE_KEY,
  FLUSH_EVERY_MS,
  admittedOnline,
  applyResults,
  batchToSend,
  dismissRefused,
  emptyQueue,
  enqueue,
  pruneSettled,
  readQueue,
  writeQueue,
  type DoorQueue,
  type QueuedScan,
} from '@/services/doorQueue';

/**
 * The door's offline queue, kept in AsyncStorage (`@findmyparty/door/queue`) and sent with
 * `POST /api/checkins/batch`: when a request succeeds again (`flush()` from the scanner), when the app
 * comes back to the front, and every 15 seconds while something is waiting.
 *
 * Every change goes through one ref and is written before the next, so two quick scans never overwrite
 * each other. An item leaves the queue only once the server has answered for it.
 */
export function useDoorQueue() {
  const [queue, setQueue] = useState<DoorQueue>(emptyQueue);
  const [ready, setReady] = useState(false);
  const current = useRef<DoorQueue>(emptyQueue());
  const writing = useRef<Promise<void>>(Promise.resolve());
  const flushing = useRef(false);
  const { mutateAsync: sendBatch } = useCheckInBatch();

  const change = useCallback((next: (q: DoorQueue) => DoorQueue) => {
    const updated = next(current.current);
    if (updated === current.current) return;
    current.current = updated;
    setQueue(updated);
    const text = writeQueue(updated);
    // Writes go one after the other, so the last change is the one stored.
    writing.current = writing.current.then(() => AsyncStorage.setItem(DOOR_QUEUE_KEY, text)).catch(() => {});
  }, []);

  // Read what a previous run left. Anything changed before it arrived is kept on top of it.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(DOOR_QUEUE_KEY)
      .catch(() => null)
      .then((text) => {
        if (cancelled) return;
        const stored = readQueue(text);
        const early = current.current;
        let merged = stored;
        for (const item of early.pending) merged = enqueue(merged, item);
        merged = { ...merged, settled: [...merged.settled, ...early.settled], refused: [...merged.refused, ...early.refused] };
        current.current = merged;
        setQueue(merged);
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Sends what is waiting. Safe to call any time: it does nothing while a send is out or nothing waits. */
  const flush = useCallback(async () => {
    if (flushing.current || current.current.pending.length === 0) return;
    flushing.current = true;
    try {
      const batch = batchToSend(current.current);
      const { results } = await sendBatch(batch);
      // Applied to the queue as it is now: scans made while the batch was out stay queued.
      const applied = applyResults(current.current, results, Date.now());
      change(() => applied.queue);
      if (applied.refused.length > 0) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {
      // No signal yet, or the server failed: everything stays queued for the next try.
    } finally {
      flushing.current = false;
    }
  }, [change, sendBatch]);

  const waiting = queue.pending.length > 0;

  // Every 15 seconds while something waits.
  useEffect(() => {
    if (!ready || !waiting) return;
    flush();
    const timer = setInterval(flush, FLUSH_EVERY_MS);
    return () => clearInterval(timer);
  }, [ready, waiting, flush]);

  // Back to the front.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') flush();
    });
    return () => sub.remove();
  }, [flush]);

  return {
    queue,
    ready,
    flush,
    /** A guest let in with no signal. */
    add: useCallback((scan: QueuedScan) => change((q) => enqueue(q, scan)), [change]),
    /** Guests the server let in: counted on this phone until a newer list has them. */
    admitted: useCallback(
      (entry: { partyId: string; codeId: string; admit: number }) => change((q) => admittedOnline(q, entry, Date.now())),
      [change],
    ),
    /** A new list of the party arrived at `receivedAt`. */
    listArrived: useCallback((partyId: string, receivedAt: number) => change((q) => pruneSettled(q, partyId, receivedAt)), [change]),
    dismissRefused: useCallback(() => change(dismissRefused), [change]),
  };
}

export type DoorQueueApi = ReturnType<typeof useDoorQueue>;
