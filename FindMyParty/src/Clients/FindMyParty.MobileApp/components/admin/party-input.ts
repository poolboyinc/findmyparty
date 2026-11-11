// The host's party form as plain data, and how it becomes the server's `PartyInput`.
// Pure (no React Native), tested in services/__tests__/acts.test.mjs.
import type { HostParty, PartyAct, PartyInput } from '@/types/api';

/** A party has at most eight acts. */
export const MAX_ACTS = 8;
/** How long a pass nobody scanned stays held after the start, unless the host says otherwise. */
export const DEFAULT_HOLD_MINUTES = 90;
export const HOLD_MIN = 15;
export const HOLD_MAX = 600;
const CAPACITY_MAX = 50_000;

const ACTS_OUTSIDE = "Set times must be inside the party's hours.";

/** A time on the clock, with no day. */
export interface ClockTime {
  hours: number;
  minutes: number;
}

/** One row of the line-up editor. `key` only keeps the row's identity while editing. */
export interface ActDraft {
  key: string;
  name: string;
  /** One of `PERFORMER_TYPES`, or null when not chosen. */
  role: string | null;
  time: ClockTime;
}

/** What the form holds while the host types. Numbers stay strings until they are checked. */
export interface PartyDraft {
  title: string;
  description: string;
  genre: string | null;
  /** The calendar day the party starts on, in the phone's time. Only its date is used. */
  day: Date;
  start: ClockTime;
  /** At or before `start` means the next morning. */
  end: ClockTime;
  price: string;
  capacity: string;
  /** 16, 18, 21 or null for none. */
  ageLimit: number | null;
  /** Minutes after the start a pass nobody scanned is held. Blank means the default. */
  holdMinutes: string;
  acts: ActDraft[];
}

export type DraftErrors = Partial<Record<'title' | 'price' | 'capacity' | 'holdMinutes' | 'acts', string>>;

function minutesOf(t: ClockTime): number {
  return t.hours * 60 + t.minutes;
}

/** That clock time on `day`, `plusDays` later. */
function on(day: Date, t: ClockTime, plusDays = 0): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + plusDays, t.hours, t.minutes, 0, 0);
}

/** When the party starts and ends. An end at or before the start on the clock is the next day. */
export function partyHours(draft: Pick<PartyDraft, 'day' | 'start' | 'end'>): { startsAt: Date; endsAt: Date } {
  const startsAt = on(draft.day, draft.start);
  const endsAt = on(draft.day, draft.end, minutesOf(draft.end) <= minutesOf(draft.start) ? 1 : 0);
  return { startsAt, endsAt };
}

/** When an act plays. A set time earlier on the clock than the party's start is after midnight. */
export function actStartsAt(draft: Pick<PartyDraft, 'day' | 'start'>, time: ClockTime): Date {
  return on(draft.day, time, minutesOf(time) < minutesOf(draft.start) ? 1 : 0);
}

/** The line-up as the server takes it: named rows only, names trimmed, in time order. */
export function toActs(draft: Pick<PartyDraft, 'day' | 'start' | 'acts'>): PartyAct[] {
  return draft.acts
    .filter((act) => act.name.trim().length > 0)
    .map((act) => ({ at: actStartsAt(draft, act.time), act }))
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map(({ at, act }) => ({ name: act.name.trim(), role: act.role, startsAt: at.toISOString() }));
}

function holdOf(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_HOLD_MINUTES;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

/** What is wrong with the draft, field by field. Empty when it can be sent. */
export function checkDraft(draft: PartyDraft): DraftErrors {
  const errors: DraftErrors = {};

  if (!draft.title.trim()) errors.title = 'Give the party a name.';

  // Strict formats: parseFloat would quietly take "12abc" as 12.
  if (!/^\d+(\.\d{1,2})?$/.test(draft.price.trim())) errors.price = 'Enter a price, like 5 or 7.50.';

  const capacity = draft.capacity.trim();
  if (!/^\d+$/.test(capacity) || Number(capacity) < 1 || Number(capacity) > CAPACITY_MAX) {
    errors.capacity = 'Capacity is a whole number from 1 to 50,000.';
  }

  const hold = holdOf(draft.holdMinutes);
  if (hold === null || hold < HOLD_MIN || hold > HOLD_MAX) errors.holdMinutes = 'Hold passes for 15 to 600 minutes.';

  const acts = toActs(draft);
  if (acts.length > MAX_ACTS) {
    errors.acts = 'A line-up has up to eight acts.';
  } else {
    const { startsAt, endsAt } = partyHours(draft);
    const outside = acts.some((act) => {
      const at = new Date(act.startsAt).getTime();
      return at < startsAt.getTime() || at >= endsAt.getTime();
    });
    if (outside) errors.acts = ACTS_OUTSIDE;
  }

  return errors;
}

/** The body for `POST /api/parties` and `PATCH /api/parties/{id}`. Call after `checkDraft` found nothing. */
export function toPartyInput(draft: PartyDraft, place: { latitude: number; longitude: number }): PartyInput {
  const { startsAt, endsAt } = partyHours(draft);
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    price: Number(draft.price.trim()),
    capacity: Number(draft.capacity.trim()),
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    latitude: place.latitude,
    longitude: place.longitude,
    genre: draft.genre,
    ageLimit: draft.ageLimit,
    holdMinutes: holdOf(draft.holdMinutes) ?? DEFAULT_HOLD_MINUTES,
    acts: toActs(draft),
  };
}

function clockOf(iso: string): ClockTime {
  const d = new Date(iso);
  return { hours: d.getHours(), minutes: d.getMinutes() };
}

/** "23:00". */
export function clockText(t: ClockTime): string {
  return `${String(t.hours).padStart(2, '0')}:${String(t.minutes).padStart(2, '0')}`;
}

/** The form for an existing party, or a new one (tonight, 22:00 to 03:00) when `party` is null. */
export function draftFromParty(party: HostParty | null, newKey: () => string, now: Date): PartyDraft {
  if (!party) {
    return {
      title: '',
      description: '',
      genre: null,
      day: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      start: { hours: 22, minutes: 0 },
      end: { hours: 3, minutes: 0 },
      price: '',
      capacity: '',
      ageLimit: null,
      holdMinutes: String(DEFAULT_HOLD_MINUTES),
      acts: [],
    };
  }

  const startsAt = new Date(party.startsAt);
  const acts = [...(party.acts ?? [])].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  return {
    title: party.title,
    description: party.description ?? '',
    genre: party.genre,
    day: new Date(startsAt.getFullYear(), startsAt.getMonth(), startsAt.getDate()),
    start: clockOf(party.startsAt),
    end: clockOf(party.endsAt),
    price: String(party.price),
    capacity: String(party.capacity),
    ageLimit: party.ageLimit,
    holdMinutes: String(party.holdMinutes || DEFAULT_HOLD_MINUTES),
    acts: acts.map((act) => ({ key: newKey(), name: act.name, role: act.role, time: clockOf(act.startsAt) })),
  };
}
