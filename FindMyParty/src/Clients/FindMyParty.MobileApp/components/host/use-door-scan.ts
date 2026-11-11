import { useCallback, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { useCheckIn, useCheckInPreview, useRedeemClaim } from '@/hooks/queries';
import { ApiError } from '@/services/api';
import { offlinePreview } from '@/services/doorQueue';
import { errorText } from '@/services/errorText';
import { parsePassText } from '@/services/passCode';
import type { CheckInPreview } from '@/types/api';
import type { DoorQueueApi } from './door/use-door-queue';
import type { SavedList } from './door/use-door-list';

/** After a result is closed, the same QR text is ignored for this long, so a pass still in view is not read twice. */
const SAME_TEXT_PAUSE_MS = 3_000;

const NOT_OURS = 'That is not a FindMyParty pass.';
const NOT_ON_LIST = "Not on tonight's list. No signal to check further.";
const NO_LIST = "No signal, and tonight's list is not on this phone yet.";
const ALL_IN_HERE = 'Everyone on this pass is already in.';
const NO_SIGNAL_PERK = 'No signal. A perk can be redeemed once the signal is back.';

export type ScanState =
  /** Looking for a pass. */
  | { phase: 'idle' }
  /** A pass was read; the server is being asked who it is. */
  | { phase: 'checking' }
  /**
   * The pass is good. Nobody has been let in yet. `offline`: there was no signal and it was found on the
   * saved list; letting in queues the entry.
   */
  | {
      phase: 'valid';
      code: string;
      codeId: string;
      scannedAt: string;
      clientScanId: string;
      preview: CheckInPreview;
      offline: boolean;
      admitting: boolean;
    }
  /** Guests were let in (or, `offline`, saved to be checked when the signal returns). */
  | { phase: 'admitted'; admitted: number; guestName: string; partyTitle: string; amountDue: number; offline: boolean }
  /** A claimed perk was redeemed. */
  | { phase: 'redeemed'; title: string; guestName: string }
  /** No: the reason in one sentence. */
  | { phase: 'refused'; reason: string; signedOut: boolean };

function isOffline(error: unknown): boolean {
  return error instanceof ApiError && error.kind === 'offline';
}

function refusedFrom(error: unknown): ScanState {
  return { phase: 'refused', reason: errorText(error), signedOut: error instanceof ApiError && error.kind === 'signed_out' };
}

type Options = {
  queue: DoorQueueApi;
  /** Tonight's list as saved on the phone, for scans with no signal. */
  list: SavedList | null;
};

/**
 * The door's scan loop: read a pass, show who it is, let them in, next. With no signal a pass is looked
 * up in the saved list and the entry is queued (BUILD-3-SPEC §3.7). A `fmpc1` code is a claimed perk and
 * is redeemed instead.
 *
 * The camera reports the same code many times a second, so `busy` is held from the first read until
 * the result is dismissed, and the same text is ignored for a few seconds after that.
 */
export function useDoorScan({ queue, list }: Options) {
  const [state, setState] = useState<ScanState>({ phase: 'idle' });
  const busy = useRef(false);
  const lastText = useRef<{ text: string; ignoreUntil: number } | null>(null);
  /** Bumped on every request and on dismiss, so an answer that arrives too late is dropped. */
  const run = useRef(0);
  // Read at answer time, not at scan time: the queue may have changed while a request was out.
  const latest = useRef({ queue, list });
  latest.current = { queue, list };

  const { mutateAsync: previewAsync } = useCheckInPreview();
  const { mutateAsync: checkInAsync } = useCheckIn();
  const { mutateAsync: redeemAsync } = useRedeemClaim();

  const fail = useCallback((next: ScanState) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setState(next);
  }, []);

  const check = useCallback(
    async (text: string) => {
      const mine = ++run.current;
      const parsed = parsePassText(text);
      if (!parsed) {
        fail({ phase: 'refused', reason: NOT_OURS, signedOut: false });
        return;
      }

      if (parsed.prefix === 'fmpc1') {
        try {
          const claim = await redeemAsync(text);
          if (run.current !== mine) return;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          latest.current.queue.flush();
          setState({ phase: 'redeemed', title: claim.title, guestName: claim.guestName });
        } catch (error) {
          if (run.current !== mine) return;
          fail(isOffline(error) ? { phase: 'refused', reason: NO_SIGNAL_PERK, signedOut: false } : refusedFrom(error));
        }
        return;
      }

      const scannedAt = new Date().toISOString();
      const base = { code: text, codeId: parsed.id, scannedAt, clientScanId: Crypto.randomUUID(), admitting: false };
      try {
        const preview = await previewAsync(text);
        if (run.current !== mine) return;
        latest.current.queue.flush();
        if (preview.outside < 1) {
          // The server refuses a fully used pass itself; this only guards an answer that should not happen.
          fail(refusedFrom(new ApiError('conflict', undefined, 409, 'already_used')));
          return;
        }
        setState({ phase: 'valid', ...base, preview, offline: false });
      } catch (error) {
        if (run.current !== mine) return;
        if (!isOffline(error)) {
          fail(refusedFrom(error));
          return;
        }
        const { list: saved, queue: q } = latest.current;
        if (!saved) {
          fail({ phase: 'refused', reason: NO_LIST, signedOut: false });
          return;
        }
        const preview = offlinePreview(saved.manifest, saved.receivedAt, q.queue, parsed.id);
        if (!preview) fail({ phase: 'refused', reason: NOT_ON_LIST, signedOut: false });
        else if (preview.outside < 1) fail({ phase: 'refused', reason: ALL_IN_HERE, signedOut: false });
        else setState({ phase: 'valid', ...base, preview, offline: true });
      }
    },
    [fail, previewAsync, redeemAsync],
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
      check(text);
    },
    [check],
  );

  /** Lets `count` guests in on the pass that is showing as valid. */
  const admit = useCallback(
    async (count: number) => {
      if (state.phase !== 'valid' || state.admitting) return;
      const valid = state;
      const { preview } = valid;
      const due = preview.dueByAdmit[count - 1] ?? count * preview.pricePerGuest;

      /** Saved to send later. The same `clientScanId` as an online try, so the server counts it once. */
      const queueIt = () => {
        latest.current.queue.add({
          clientScanId: valid.clientScanId,
          code: valid.code,
          admit: count,
          scannedAt: valid.scannedAt,
          partyId: preview.partyId,
          codeId: valid.codeId,
          guestName: preview.guestName,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setState({ phase: 'admitted', admitted: count, guestName: preview.guestName, partyTitle: preview.partyTitle, amountDue: due, offline: true });
      };

      if (valid.offline) {
        queueIt();
        return;
      }

      const mine = ++run.current;
      setState({ ...valid, admitting: true });
      try {
        const result = await checkInAsync({ code: valid.code, admit: count, clientScanId: valid.clientScanId });
        if (run.current !== mine) return;
        latest.current.queue.admitted({ partyId: preview.partyId, codeId: valid.codeId, admit: result.admitted });
        latest.current.queue.flush();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        setState({
          phase: 'admitted',
          admitted: result.admitted,
          guestName: result.guestName,
          partyTitle: result.partyTitle,
          amountDue: result.amountDue,
          offline: false,
        });
      } catch (error) {
        if (run.current !== mine) return;
        // The entry may or may not have reached the server; queued with the same id it counts once either way.
        if (isOffline(error)) queueIt();
        else fail(refusedFrom(error));
      }
    },
    [state, checkInAsync, fail],
  );

  /** The result was closed (or the scanner left the screen): scanning resumes. */
  const reset = useCallback(() => {
    run.current += 1;
    busy.current = false;
    if (lastText.current) lastText.current.ignoreUntil = Date.now() + SAME_TEXT_PAUSE_MS;
    setState({ phase: 'idle' });
  }, []);

  return { state, onScanned, admit, reset };
}
