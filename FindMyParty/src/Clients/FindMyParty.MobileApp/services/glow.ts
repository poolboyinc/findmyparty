// Glow: points, levels, streak and badges, all worked out on the phone from the guest's real door scans.
// Pure, tested in services/__tests__/glow.test.mjs.
//
// A booking with `checkedInCount > 0` is a night out at its party's venue. Points per night:
// 100 for the scan, +25 if first scanned before 00:00 local time, +50 the first time at that venue.
// A night runs until 06:00: a scan at 02:00 on Saturday is Friday night, and it is after midnight.

import type { Booking } from '../types/api.ts';

export const POINTS = { scan: 100, beforeMidnight: 25, firstAtVenue: 50 } as const;

export interface Level {
  name: string;
  /** Glow needed to reach it. */
  min: number;
}

export const LEVELS: readonly Level[] = [
  { name: 'Spark', min: 0 },
  { name: 'Ember', min: 300 },
  { name: 'Flame', min: 1000 },
  { name: 'Blaze', min: 2000 },
  { name: 'Inferno', min: 4000 },
];

/** Weekends in a row that make a regular. */
export const REGULAR_STREAK = 3;

export type GlowPartKind = 'scan' | 'beforeMidnight' | 'firstAtVenue';

export interface GlowPart {
  kind: GlowPartKind;
  points: number;
  /** "check-in", "before midnight", "first time here". */
  label: string;
}

/** One night out: a booking the door scanned. */
export interface Night {
  bookingId: string;
  venueId: string | null;
  venueName: string | null;
  partyTitle: string | null;
  genre: string | null;
  /** When the door first scanned it (UTC ISO). Falls back to the party's start when the server sent no time. */
  at: string;
  /** False when `at` is the party's start, not a real scan time. */
  timed: boolean;
  points: number;
  parts: GlowPart[];
}

export interface HistoryRow {
  bookingId: string;
  /** "Scanned in at Kula". */
  title: string;
  points: number;
  at: string;
}

export type BadgeId = 'first-night' | 'before-midnight' | 'three-venues' | 'regular';

export interface Badge {
  id: BadgeId;
  label: string;
  /** What earns it, for screen readers. */
  hint: string;
  earned: boolean;
}

export interface LevelStanding {
  level: Level;
  /** 1–5. */
  levelNumber: number;
  next: Level | null;
  /** Glow still needed for the next level; null at the top. */
  toNext: number | null;
  /** 0–1 through the current level. 1 at the top. */
  progress: number;
  /** 0–1 of the way from zero to the next level (the ring on Glow). 1 at the top. */
  ring: number;
  /** 0–1 along the five-level bar, where each level sits a quarter further on. */
  ladder: number;
}

export interface Glow extends LevelStanding {
  total: number;
  /** Oldest first. */
  nights: Night[];
  /** Newest first. */
  history: HistoryRow[];
  nightsOut: number;
  venuesLit: number;
  /** Weekends in a row (Friday to Sunday) with a night out, ending this weekend or the last one. */
  streak: number;
  badges: Badge[];
}

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;
/** Until this local hour, a scan still belongs to the night before. */
const NIGHT_ENDS_HOUR = 6;
const FRIDAY = 5;

export function levelFor(total: number): LevelStanding {
  let index = 0;
  for (let i = 0; i < LEVELS.length; i += 1) {
    if (total >= LEVELS[i].min) index = i;
  }
  const level = LEVELS[index];
  const next = LEVELS[index + 1] ?? null;
  if (!next) {
    return { level, levelNumber: index + 1, next: null, toNext: null, progress: 1, ring: 1, ladder: 1 };
  }
  const progress = (total - level.min) / (next.min - level.min);
  return {
    level,
    levelNumber: index + 1,
    next,
    toNext: next.min - total,
    progress,
    ring: total / next.min,
    ladder: (index + progress) / (LEVELS.length - 1),
  };
}

/** Days since 1970-01-01 of the local calendar date. */
function localDay(date: Date): number {
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY);
}

/** The local date of the night this moment belongs to. */
function nightDay(date: Date): number {
  return localDay(new Date(date.getTime() - NIGHT_ENDS_HOUR * HOUR));
}

/** 0 Sunday … 6 Saturday. 1970-01-01 was a Thursday. */
function weekday(day: number): number {
  return (((day + 4) % 7) + 7) % 7;
}

function isWeekend(day: number): boolean {
  const wd = weekday(day);
  return wd === FRIDAY || wd === 6 || wd === 0;
}

/** The Friday on or before this day: the key of its weekend. */
function fridayOf(day: number): number {
  return day - ((weekday(day) - FRIDAY + 7) % 7);
}

function beforeMidnight(at: Date): boolean {
  return at.getHours() >= NIGHT_ENDS_HOUR;
}

/** Weekends in a row with a night out, counting back from this weekend (if it has one yet) or the last. */
export function weekendStreak(scans: Date[], now: Date): number {
  const weekends = new Set<number>();
  for (const scan of scans) {
    const day = nightDay(scan);
    if (isWeekend(day)) weekends.add(fridayOf(day));
  }
  const today = nightDay(now);
  const anchor = fridayOf(today);
  let friday: number;
  if (weekends.has(anchor)) friday = anchor;
  else if (isWeekend(today) && weekends.has(anchor - 7)) friday = anchor - 7;
  else return 0;

  let streak = 0;
  while (weekends.has(friday)) {
    streak += 1;
    friday -= 7;
  }
  return streak;
}

function part(kind: GlowPartKind): GlowPart {
  switch (kind) {
    case 'scan':
      return { kind, points: POINTS.scan, label: 'check-in' };
    case 'beforeMidnight':
      return { kind, points: POINTS.beforeMidnight, label: 'before midnight' };
    case 'firstAtVenue':
      return { kind, points: POINTS.firstAtVenue, label: 'first time here' };
  }
}

function sum(parts: GlowPart[]): number {
  return parts.reduce((total, p) => total + p.points, 0);
}

/** Every scanned booking as a night out with its points, oldest first. */
export function nightsFrom(bookings: Booking[]): Night[] {
  const scanned = bookings
    .filter((booking) => booking.checkedInCount > 0)
    .map((booking) => {
      const timed = !!booking.firstCheckedInAt;
      const at = booking.firstCheckedInAt || booking.party?.startsAt || booking.createdAt;
      return { booking, timed, at };
    })
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.booking.id.localeCompare(b.booking.id));

  const seen = new Set<string>();
  return scanned.map(({ booking, timed, at }) => {
    const venueId = booking.party?.venueId ?? null;
    const parts: GlowPart[] = [part('scan')];
    // Without a real scan time the early bonus would be a guess, so it is not given.
    if (timed && beforeMidnight(new Date(at))) parts.push(part('beforeMidnight'));
    if (venueId && !seen.has(venueId)) {
      seen.add(venueId);
      parts.push(part('firstAtVenue'));
    }
    return {
      bookingId: booking.id,
      venueId,
      venueName: booking.party?.venueName ?? null,
      partyTitle: booking.party?.title ?? null,
      genre: booking.party?.genre ?? null,
      at,
      timed,
      points: sum(parts),
      parts,
    };
  });
}

function historyTitle(night: Night): string {
  const place = night.venueName || night.partyTitle;
  return place ? `Scanned in at ${place}` : 'Scanned in';
}

function badgesFrom(nights: Night[], venuesLit: number, streak: number): Badge[] {
  return [
    { id: 'first-night', label: 'First night', hint: 'Your first night out', earned: nights.length > 0 },
    {
      id: 'before-midnight',
      label: 'Before midnight',
      hint: 'Scanned in before midnight',
      earned: nights.some((night) => night.parts.some((p) => p.kind === 'beforeMidnight')),
    },
    { id: 'three-venues', label: 'Three venues', hint: 'Out at three different venues', earned: venuesLit >= 3 },
    {
      id: 'regular',
      label: 'Regular',
      hint: `Out ${REGULAR_STREAK} weekends in a row`,
      earned: streak >= REGULAR_STREAK,
    },
  ];
}

export function glowFrom(bookings: Booking[], now: Date = new Date()): Glow {
  const nights = nightsFrom(bookings);
  const total = nights.reduce((acc, night) => acc + night.points, 0);
  const venuesLit = new Set(nights.map((night) => night.venueId).filter((id): id is string => !!id)).size;
  const streak = weekendStreak(
    nights.map((night) => new Date(night.at)),
    now,
  );
  const history = nights
    .slice()
    .reverse()
    .map((night) => ({ bookingId: night.bookingId, title: historyTitle(night), points: night.points, at: night.at }));

  return {
    total,
    ...levelFor(total),
    nights,
    history,
    nightsOut: nights.length,
    venuesLit,
    streak,
    badges: badgesFrom(nights, venuesLit, streak),
  };
}

/** "1,240": thousands with a comma, as on the Glow ring. */
export function formatGlow(points: number): string {
  return String(Math.round(points)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** "100 check-in, 25 before midnight, 50 first time here". */
export function breakdownLine(parts: GlowPart[]): string {
  return parts.map((p) => `${p.points} ${p.label}`).join(', ');
}

export interface ScanReward {
  points: number;
  parts: GlowPart[];
  line: string;
  /** The weekend streak counting this scan. */
  streak: number;
}

/**
 * What the scan that just happened earned. The bookings may not show the scan yet (the refetch is
 * still under way), so the booking is counted as scanned at `scannedAt` unless the server already
 * has a time for it.
 */
export function scanReward(bookings: Booking[], bookingId: string, scannedAt: Date): ScanReward {
  const iso = scannedAt.toISOString();
  const known = bookings.some((booking) => booking.id === bookingId);
  const marked = bookings.map((booking) =>
    booking.id === bookingId
      ? { ...booking, checkedInCount: Math.max(1, booking.checkedInCount), firstCheckedInAt: booking.firstCheckedInAt || iso }
      : booking,
  );
  const nights = nightsFrom(marked);
  const scans = nights.map((night) => new Date(night.at));
  const night = known ? nights.find((n) => n.bookingId === bookingId) : undefined;
  const parts = night
    ? night.parts
    : beforeMidnight(scannedAt)
      ? [part('scan'), part('beforeMidnight')]
      : [part('scan')];
  if (!known) scans.push(scannedAt);

  return { points: sum(parts), parts, line: breakdownLine(parts), streak: weekendStreak(scans, scannedAt) };
}

/** How long around a party's start and end a door scan is still taken to be for it. */
const SCAN_WINDOW = 3 * HOUR;

/**
 * The booking the door most likely just scanned, when only the venue's name is known:
 * a live booking at that venue whose party is on now. Prefers one the server already shows as scanned last.
 */
export function scannedBookingId(bookings: Booking[], scan: { venueName: string | null; now: Date }): string | null {
  const now = scan.now.getTime();
  const candidates = bookings.filter((booking) => {
    if (booking.status === 'Cancelled' || !booking.party) return false;
    if (scan.venueName && booking.party.venueName !== scan.venueName) return false;
    const starts = Date.parse(booking.party.startsAt);
    const ends = Date.parse(booking.party.endsAt);
    return now >= starts - SCAN_WINDOW && now <= ends + SCAN_WINDOW;
  });
  if (candidates.length === 0) return null;

  const scannedAt = (booking: Booking) => (booking.firstCheckedInAt ? Date.parse(booking.firstCheckedInAt) : -Infinity);
  const best = candidates.reduce((a, b) => (scannedAt(b) > scannedAt(a) ? b : a));
  return best.id;
}

export interface SoundShare {
  label: string;
  /** Whole percent; the shares add up to 100. */
  share: number;
}

/** Picks in order, without a scanned night to go by. */
const PICK_WEIGHTS = [52, 30, 18] as const;

function capitalise(text: string): string {
  const trimmed = text.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** Whole percentages that add up to 100 (largest remainder). */
function percentages(weights: number[]): number[] {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (w / total) * 100);
  const floors = exact.map(Math.floor);
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => ({ i, rest: e - Math.floor(e) })).sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  return floors;
}

/**
 * "Your sound": the three genres the guest goes out to most, from the parties they were scanned into.
 * Before any such night, the first three music picks at 52, 30 and 18 percent.
 */
export function soundShares(taste: string[], nights: Night[]): SoundShare[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const night of nights) {
    if (!night.genre?.trim()) continue;
    const key = night.genre.trim().toLowerCase();
    const entry = counts.get(key);
    if (entry) entry.count += 1;
    else counts.set(key, { label: capitalise(night.genre), count: 1 });
  }

  if (counts.size > 0) {
    // Map keeps first-seen order, and the sort is stable, so ties go to the genre seen first.
    const top = [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 3);
    const shares = percentages(top.map((entry) => entry.count));
    return top.map((entry, i) => ({ label: entry.label, share: shares[i] }));
  }

  const picks: string[] = [];
  for (const pick of taste) {
    if (!pick.trim()) continue;
    if (picks.some((p) => p.toLowerCase() === pick.trim().toLowerCase())) continue;
    picks.push(pick.trim());
    if (picks.length === PICK_WEIGHTS.length) break;
  }
  const shares = percentages(PICK_WEIGHTS.slice(0, picks.length));
  return picks.map((pick, i) => ({ label: capitalise(pick), share: shares[i] }));
}
