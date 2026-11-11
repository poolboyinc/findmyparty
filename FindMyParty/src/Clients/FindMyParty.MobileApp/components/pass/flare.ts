// Words and rules for the scan flare (S-15). Pure, no React; tested in services/__tests__/flare.test.mjs.
import type { GlowAward, GlowPart } from '@/types/api';

/** The streak week from which every scan earns ×1.5 (`GlowSummary.multiplierFromWeek`). */
export const MULTIPLIER_FROM_WEEK = 4;
/** Segments on the weekend-streak bar: one per week up to the multiplier. */
export const STREAK_STEPS = MULTIPLIER_FROM_WEEK;
/** How many flared bookings are remembered on the phone. */
export const FLARED_CAP = 50;

const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four', 'five'] as const;

/** "1,240" */
function grouped(points: number): string {
  return String(Math.round(points)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** "+150 Glow" */
export function pointsLine(points: number): string {
  return `+${grouped(points)} Glow`;
}

/** "100 check-in, 25 before midnight, 25 streak": each part's points and label, as the server names them. */
export function breakdownLine(parts: readonly GlowPart[]): string {
  return parts
    .filter((part) => part.points !== 0 && part.label)
    .map((part) => `${grouped(part.points)} ${part.label}`)
    .join(', ');
}

/** "Scanned 23:47 at Monkey" */
export function scannedLine(time: string, venueName: string | null | undefined): string {
  return venueName ? `Scanned ${time} at ${venueName}` : `Scanned ${time}`;
}

export type StreakCopy = {
  /** "3 weeks" */
  weeks: string;
  /** "one more for ×1.5", or from the multiplier's week "×1.5 on every scan". */
  next: string;
  /** Segments to light, at most `STREAK_STEPS`. */
  lit: number;
};

/** The weekend-streak card. Null with no streak, so no card is drawn. */
export function streakCopy(streakWeeks: number): StreakCopy | null {
  if (!(streakWeeks > 0)) return null;
  const weeks = Math.floor(streakWeeks);
  const toGo = MULTIPLIER_FROM_WEEK - weeks;
  return {
    weeks: `${weeks} ${weeks === 1 ? 'week' : 'weeks'}`,
    next: toGo > 0 ? `${COUNT_WORDS[toGo] ?? toGo} more for ×1.5` : '×1.5 on every scan',
    lit: Math.min(weeks, STREAK_STEPS),
  };
}

/** One ask for the flare: from a push (with the server's award when it came along) or from the Pass tab's poll. */
export type FlareRequest = {
  bookingId: string;
  award: GlowAward | null;
  /** The venue as known before the award arrives (the pass's venue). */
  venueName: string | null;
  /** When the scan was noticed, in milliseconds. The award's `at` wins once known. */
  noticedAt: number;
  /** Came from a tapped push (PushRegistrar opens the Pass tab under the flare). */
  tapped: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** The award inside a push, when it has the shape the flare needs. Anything else is ignored. */
function awardFrom(value: unknown, bookingId: string): GlowAward | null {
  if (!isRecord(value) || typeof value.points !== 'number' || !Array.isArray(value.parts)) return null;
  const parts = value.parts.filter(
    (part): part is GlowPart => isRecord(part) && typeof part.points === 'number' && typeof part.label === 'string',
  );
  return {
    bookingId: typeof value.bookingId === 'string' ? value.bookingId : bookingId,
    at: typeof value.at === 'string' ? value.at : '',
    venueId: typeof value.venueId === 'string' ? value.venueId : null,
    venueName: typeof value.venueName === 'string' ? value.venueName : null,
    points: value.points,
    parts,
    streakWeeks: typeof value.streakWeeks === 'number' ? value.streakWeeks : 0,
  };
}

/**
 * Reads a push's `data`: a `scanned` push (BUILD-3-SPEC §2.6, `{ type, bookingId, award }`) becomes a flare
 * request; anything else is null. The data may arrive as a string on some paths, so that is read too.
 */
export function flareFromPush(data: unknown, tapped: boolean, nowMs: number): FlareRequest | null {
  let value: unknown = data;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!isRecord(value) || value.type !== 'scanned' || typeof value.bookingId !== 'string' || !value.bookingId) return null;
  const award = awardFrom(value.award, value.bookingId);
  return { bookingId: value.bookingId, award, venueName: award?.venueName ?? null, noticedAt: nowMs, tapped };
}

/**
 * One flare per booking. `seen` are the bookings that already had theirs (kept on the phone, newest last).
 * `admit` says whether this one may flare and remembers it; the list keeps the last `FLARED_CAP`.
 */
export function createFlareGate(seen: readonly string[] = []) {
  let list = seen.slice(-FLARED_CAP).map((id) => id.toLowerCase());
  return {
    admit(bookingId: string): boolean {
      const id = bookingId.toLowerCase();
      if (list.includes(id)) return false;
      list = [...list, id].slice(-FLARED_CAP);
      return true;
    },
    /** Adds ids read later (from storage) without flaring them. */
    merge(ids: readonly string[]) {
      const known = new Set(list);
      list = [...ids.map((id) => id.toLowerCase()).filter((id) => !known.has(id)), ...list].slice(-FLARED_CAP);
    },
    seen(): string[] {
      return [...list];
    },
  };
}

export type FlareGate = ReturnType<typeof createFlareGate>;
