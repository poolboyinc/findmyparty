import { useCallback, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { useCheckIn, useCheckInPreview } from '@/hooks/queries';
import { ApiError } from '@/services/api';
import type { CheckInPreview, CheckInResult } from '@/types/api';

/** After a result is closed, the same QR text is ignored for this long, so a pass still in view is not read twice. */
const SAME_TEXT_PAUSE_MS = 3_000;

export type ScanState =
  /** Looking for a pass. */
  | { phase: 'idle' }
  /** A pass was read; the server is being asked who it is. */
  | { phase: 'checking' }
  /** The pass is good. Nobody has been let in yet. */
  | { phase: 'valid'; code: string; preview: CheckInPreview; admitting: boolean }
  /** Guests were let in. */
  | { phase: 'admitted'; result: CheckInResult }
  /** The server said no. `error` carries the reason. */
  | { phase: 'refused'; error: unknown }
  /** No answer from the server. `during` says which request was lost. */
  | { phase: 'offline'; code: string; during: 'check' | 'admit'; retrying: boolean };

function isOffline(error: unknown): boolean {
  return error instanceof ApiError && error.kind === 'offline';
}

/**
 * The door's scan loop: read a pass, show who it is, let them in, next.
 *
 * The camera reports the same code many times a second, so `busy` is held from the first read until
 * the result is dismissed, and the same text is ignored for a few seconds after that.
 */
export function useDoorScan() {
  const [state, setState] = useState<ScanState>({ phase: 'idle' });
  const busy = useRef(false);
  const lastText = useRef<{ text: string; ignoreUntil: number } | null>(null);
  /** Bumped on every request and on dismiss, so an answer that arrives too late is dropped. */
  const run = useRef(0);

  const { mutateAsync: previewAsync } = useCheckInPreview();
  const { mutateAsync: checkInAsync } = useCheckIn();

  /** Asks the server about a pass without letting anyone in. */
  const check = useCallback(
    async (code: string, during: 'check' | 'admit') => {
      const mine = ++run.current;
      try {
        const preview = await previewAsync(code);
        if (run.current !== mine) return;
        if (preview.outside < 1) {
          // The server refuses a fully used pass itself; this only guards an answer that should not happen.
          throw new ApiError('conflict', undefined, 409, 'already_used');
        }
        setState({ phase: 'valid', code, preview, admitting: false });
      } catch (error) {
        if (run.current !== mine) return;
        if (isOffline(error)) {
          setState({ phase: 'offline', code, during, retrying: false });
          return;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setState({ phase: 'refused', error });
      }
    },
    [previewAsync],
  );

  /** Give this the text of every code the camera reports. Repeats are ignored. */
  const onScanned = useCallback(
    (text: string) => {
      if (busy.current) return;
      const last = lastText.current;
      if (last && last.text === text && Date.now() < last.ignoreUntil) return;

      busy.current = true;
      lastText.current = { text, ignoreUntil: Number.POSITIVE_INFINITY };
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setState({ phase: 'checking' });
      check(text, 'check');
    },
    [check],
  );

  /** Lets `count` guests in on the pass that was just found valid. */
  const admit = useCallback(
    async (code: string, count: number) => {
      const mine = ++run.current;
      setState((prev) => (prev.phase === 'valid' ? { ...prev, admitting: true } : prev));
      try {
        const result = await checkInAsync({ code, admit: count });
        if (run.current !== mine) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setState({ phase: 'admitted', result });
      } catch (error) {
        if (run.current !== mine) return;
        if (isOffline(error)) {
          setState({ phase: 'offline', code, during: 'admit', retrying: false });
          return;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setState({ phase: 'refused', error });
      }
    },
    [checkInAsync],
  );

  /**
   * After no answer: asks about the pass again. A lost check is simply repeated. A lost entry is
   * not sent a second time blindly, because the first may have reached the server; the pass is read
   * again instead, and the door confirms against what the server now says.
   */
  const retry = useCallback(
    (code: string, during: 'check' | 'admit') => {
      setState((prev) => (prev.phase === 'offline' ? { ...prev, retrying: true } : prev));
      check(code, during);
    },
    [check],
  );

  /** The result was closed (or the scanner left the screen): scanning resumes. */
  const reset = useCallback(() => {
    run.current += 1;
    busy.current = false;
    if (lastText.current) lastText.current.ignoreUntil = Date.now() + SAME_TEXT_PAUSE_MS;
    setState({ phase: 'idle' });
  }, []);

  return { state, onScanned, admit, retry, reset };
}
