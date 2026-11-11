// The door with no signal (BUILD-3-SPEC §3.7). Pure: no React Native, no storage. The scanner keeps the
// state in AsyncStorage under `DOOR_QUEUE_KEY` and calls these to change it. Tested in
// services/__tests__/doorQueue.test.mjs.
//
// - `pending`: guests let in with no signal, to send with `POST /api/checkins/batch`. An item stays here
//   until the server has answered for it, so a restart in the middle of a send sends the same ids again
//   (the server counts a `clientScanId` once).
// - `settled`: guests the server has taken (online, or from a batch). They keep counting against the
//   saved list of tonight's passes until a list fetched well after them arrives, because an older list
//   still shows them outside.
// - `refused`: offline scans the server turned down, for the banner over the camera.
import { euros } from '../components/host/format.ts';
import type { BatchScanItem, BatchScanResult, CheckInPreview, DoorManifest, ManifestPass, MoneyLine } from '@/types/api';

export const DOOR_QUEUE_KEY = '@findmyparty/door/queue';
/** Where tonight's list for a party is saved, with the time it arrived. */
export const doorManifestKey = (partyId: string) => `@findmyparty/door/manifest/${partyId}`;

/** How often a non-empty queue is sent while the scanner is open. */
export const FLUSH_EVERY_MS = 15_000;
/** The server takes at most this many items per batch. */
export const BATCH_MAX = 100;
/**
 * A list that arrived less than this after an entry was confirmed may have been made before it.
 * Longer than a request can take (8 s), so a list that arrived later surely includes the entry.
 */
export const SETTLE_MARGIN_MS = 30_000;
/** Settled entries are forgotten after a day whatever happens. */
const SETTLED_KEPT_MS = 24 * 60 * 60_000;

/** A guest let in with no signal: what the server needs, plus what the phone needs to count and explain it. */
export interface QueuedScan extends BatchScanItem {
  partyId: string;
  /** The pass id from the QR, 32 hex. */
  codeId: string;
  guestName: string;
}

/** Guests the server took, still counted against an older list. `at` is the phone's clock (ms). */
export interface SettledAdmit {
  partyId: string;
  codeId: string;
  admit: number;
  at: number;
}

export interface RefusedScan {
  clientScanId: string;
  guestName: string;
  code: string | null;
  /** The server's sentence. */
  title: string;
}

export interface DoorQueue {
  pending: QueuedScan[];
  settled: SettledAdmit[];
  refused: RefusedScan[];
}

export function emptyQueue(): DoorQueue {
  return { pending: [], settled: [], refused: [] };
}

/** The id as the list stores it: 32 lower-case hex, no dashes. */
export function normalId(id: string): string {
  return id.replace(/-/g, '').toLowerCase();
}

// ── storage ──

const isString = (v: unknown): v is string => typeof v === 'string';
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function asPending(v: unknown): QueuedScan | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (!isString(o.clientScanId) || !isString(o.code) || !isNumber(o.admit) || !isString(o.scannedAt)) return null;
  if (!isString(o.partyId) || !isString(o.codeId)) return null;
  return {
    clientScanId: o.clientScanId,
    code: o.code,
    admit: o.admit,
    scannedAt: o.scannedAt,
    partyId: o.partyId,
    codeId: o.codeId,
    guestName: isString(o.guestName) ? o.guestName : '',
  };
}

function asSettled(v: unknown): SettledAdmit | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (!isString(o.partyId) || !isString(o.codeId) || !isNumber(o.admit) || !isNumber(o.at)) return null;
  return { partyId: o.partyId, codeId: o.codeId, admit: o.admit, at: o.at };
}

function asRefused(v: unknown): RefusedScan | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (!isString(o.clientScanId) || !isString(o.title)) return null;
  return { clientScanId: o.clientScanId, title: o.title, guestName: isString(o.guestName) ? o.guestName : '', code: isString(o.code) ? o.code : null };
}

function listOf<T>(v: unknown, read: (item: unknown) => T | null): T[] {
  return Array.isArray(v) ? v.map(read).filter((x): x is T => x !== null) : [];
}

/** The queue from what was stored. Nothing stored, or anything unreadable, is an empty queue. */
export function readQueue(text: string | null | undefined): DoorQueue {
  if (!text) return emptyQueue();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return emptyQueue();
  }
  if (!parsed || typeof parsed !== 'object') return emptyQueue();
  const o = parsed as Record<string, unknown>;
  return { pending: listOf(o.pending, asPending), settled: listOf(o.settled, asSettled), refused: listOf(o.refused, asRefused) };
}

export function writeQueue(queue: DoorQueue): string {
  return JSON.stringify(queue);
}

// ── changes ──

/** Adds a guest let in with no signal. The same `clientScanId` twice is one entry. */
export function enqueue(queue: DoorQueue, scan: QueuedScan): DoorQueue {
  if (queue.pending.some((p) => p.clientScanId === scan.clientScanId)) return queue;
  return { ...queue, pending: [...queue.pending, { ...scan, codeId: normalId(scan.codeId) }] };
}

/** Guests the server let in while there was signal: counted on the phone until a newer list has them. */
export function admittedOnline(queue: DoorQueue, entry: { partyId: string; codeId: string; admit: number }, now: number): DoorQueue {
  return { ...queue, settled: [...queue.settled, { ...entry, codeId: normalId(entry.codeId), at: now }] };
}

/** What to send now: the oldest items, as the server takes them. */
export function batchToSend(queue: DoorQueue): BatchScanItem[] {
  return queue.pending
    .slice(0, BATCH_MAX)
    .map(({ clientScanId, code, admit, scannedAt }) => ({ clientScanId, code, admit, scannedAt }));
}

/**
 * The server's answer to a batch. Admitted items move to `settled`, refused ones to `refused` (and give
 * their spot back on this phone); items it did not answer for stay queued.
 */
export function applyResults(
  queue: DoorQueue,
  results: readonly Pick<BatchScanResult, 'clientScanId' | 'status' | 'code' | 'title'>[],
  now: number,
): { queue: DoorQueue; refused: RefusedScan[] } {
  const byId = new Map(results.map((r) => [r.clientScanId, r]));
  const pending: QueuedScan[] = [];
  const settled = [...queue.settled];
  const refused: RefusedScan[] = [];

  for (const item of queue.pending) {
    const result = byId.get(item.clientScanId);
    if (!result) {
      pending.push(item);
    } else if (result.status === 'admitted') {
      settled.push({ partyId: item.partyId, codeId: item.codeId, admit: item.admit, at: now });
    } else {
      refused.push({
        clientScanId: item.clientScanId,
        guestName: item.guestName,
        code: result.code ?? null,
        title: result.title || result.code || 'Refused',
      });
    }
  }

  return { queue: { pending, settled, refused: [...queue.refused, ...refused] }, refused };
}

/** A list of `partyId` arrived at `receivedAt`: forgets the settled entries it surely includes, and any a day old. */
export function pruneSettled(queue: DoorQueue, partyId: string, receivedAt: number): DoorQueue {
  const settled = queue.settled.filter(
    (s) => receivedAt - s.at < SETTLED_KEPT_MS && !(s.partyId === partyId && receivedAt >= s.at + SETTLE_MARGIN_MS),
  );
  return settled.length === queue.settled.length ? queue : { ...queue, settled };
}

/** The banner was read. */
export function dismissRefused(queue: DoorQueue): DoorQueue {
  return queue.refused.length ? { ...queue, refused: [] } : queue;
}

// ── reading ──

/** Guests let in with no signal at this party, not yet sent. */
export function pendingAdmits(queue: DoorQueue, partyId: string): number {
  return queue.pending.filter((p) => p.partyId === partyId).reduce((sum, p) => sum + p.admit, 0);
}

/** "1 offline scan was refused: {title}", with the latest reason. Null when there is nothing to say. */
export function refusedBanner(refused: readonly RefusedScan[]): string | null {
  if (refused.length === 0) return null;
  const latest = refused[refused.length - 1].title;
  return refused.length === 1
    ? `1 offline scan was refused: ${latest}`
    : `${refused.length} offline scans were refused: ${latest}`;
}

/**
 * A pass on the saved list (`receivedAt` = when the list arrived, phone clock), with what this phone has
 * let in since: `usedHere` guests, `outside` still to come in. Null when it is not on the list.
 */
export function lookUp(
  manifest: DoorManifest | null | undefined,
  receivedAt: number,
  queue: DoorQueue,
  codeId: string,
): { pass: ManifestPass; outside: number; usedHere: number } | null {
  if (!manifest) return null;
  const id = normalId(codeId);
  const pass = manifest.passes.find((p) => normalId(p.codeId) === id);
  if (!pass) return null;
  const queued = queue.pending.filter((p) => p.partyId === manifest.partyId && p.codeId === id).reduce((n, p) => n + p.admit, 0);
  const settled = queue.settled
    .filter((s) => s.partyId === manifest.partyId && s.codeId === id && receivedAt < s.at + SETTLE_MARGIN_MS)
    .reduce((n, s) => n + s.admit, 0);
  const usedHere = queued + settled;
  return { pass, outside: Math.max(0, pass.outside - usedHere), usedHere };
}

/**
 * What the valid sheet shows for a pass found on the saved list with no signal. The perk's discount comes
 * with the first admission only: once this phone has let someone in on the pass, each guest pays full price.
 * The discount carries the perk's own words when the list has them, else "Perk on this pass".
 */
export function offlinePreview(
  manifest: DoorManifest | null | undefined,
  receivedAt: number,
  queue: DoorQueue,
  codeId: string,
): CheckInPreview | null {
  const found = lookUp(manifest, receivedAt, queue, codeId);
  if (!manifest || !found) return null;
  const { pass, outside, usedHere } = found;
  const price = pass.pricePerGuest;
  const due = (n: number) => (usedHere > 0 ? n * price : (pass.dueByAdmit[n - 1] ?? n * price));
  const dueByAdmit = Array.from({ length: outside }, (_, i) => due(i + 1));

  const lines: MoneyLine[] = [];
  if (outside > 0 && price > 0) {
    lines.push({ label: `Entry, ${outside} × ${euros(price)}`, amount: outside * price, perk: false });
    const discount = due(outside) - outside * price;
    if (discount < 0) lines.push({ label: pass.perkLabel ?? 'Perk on this pass', amount: discount, perk: true });
  }

  return {
    bookingId: normalId(pass.codeId),
    kind: pass.kind,
    partyId: manifest.partyId,
    partyTitle: manifest.partyTitle,
    guestName: pass.guestName,
    levelName: pass.levelName,
    ticketCount: pass.outside,
    checkedInCount: usedHere,
    outside,
    pricePerGuest: price,
    lines,
    dueByAdmit,
    skipLine: pass.skipLine,
  };
}
