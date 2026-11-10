// Wording for parties and venues: prices, times, days. Pure (no React Native imports), so it runs in plain Node.
import { crowdText } from '../../services/crowd.ts';
import type { Party } from '../../types/api.ts';

/** What a card or row needs. Both the feed's `Party` and a `PartyDetail` fit. */
export type PartyListing = Pick<
  Party,
  'id' | 'title' | 'price' | 'startsAt' | 'endsAt' | 'isSoldOut' | 'imageUrl' | 'genre' | 'venueName'
> &
  Partial<Pick<Party, 'crowdLevel' | 'crowdSource'>>;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const DAY_MS = 24 * 60 * 60_000;
/** A night runs until six in the morning, so a party that starts at 00:30 is still "tonight". */
const NIGHT_ENDS_AT_HOUR = 6;

type Part = string | null | undefined | false;

/** "Monkey, Techno, until 04:00": the parts that exist, joined with commas. */
export function joinParts(parts: Part[]): string {
  return parts.filter((part): part is string => typeof part === 'string' && part.trim().length > 0).join(', ');
}

/** "€5", "€7.50", or "Free" for zero. */
export function priceText(price: number): string {
  if (!(price > 0)) return 'Free';
  return Number.isInteger(price) ? `€${price}` : `€${price.toFixed(2)}`;
}

function two(n: number): string {
  return String(n).padStart(2, '0');
}

/** "23:00" in the phone's own time. Empty when the date cannot be read. */
export function timeText(at: string | number): string {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? '' : `${two(d.getHours())}:${two(d.getMinutes())}`;
}

/** "Fri". */
export function weekdayText(at: string | number): string {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? '' : WEEKDAYS[d.getDay()];
}

/** "Fri 13". */
export function shortDateText(at: string | number): string {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? '' : `${WEEKDAYS[d.getDay()]} ${d.getDate()}`;
}

/** "Fri 13 Nov". */
export function dateText(at: string | number): string {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? '' : `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** When the night that `now` belongs to ends: the next six in the morning. */
export function nightEnd(now: number): number {
  const d = new Date(now);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), NIGHT_ENDS_AT_HOUR);
  if (d.getHours() >= NIGHT_ENDS_AT_HOUR) end.setDate(end.getDate() + 1);
  return end.getTime();
}

export function isOver(party: Pick<Party, 'endsAt'>, now: number): boolean {
  return Date.parse(party.endsAt) <= now;
}

export function isOnNow(party: Pick<Party, 'startsAt' | 'endsAt'>, now: number): boolean {
  return Date.parse(party.startsAt) <= now && !isOver(party, now);
}

/** "Tonight", "Tomorrow", else weekday and date. A party that is over always gets its date. */
export function dayText(party: Pick<Party, 'startsAt' | 'endsAt'>, now: number): string {
  const start = Date.parse(party.startsAt);
  if (Number.isNaN(start)) return '';
  if (!isOver(party, now)) {
    const tonightEnds = nightEnd(now);
    if (start < tonightEnds) return 'Tonight';
    if (start < nightEnd(tonightEnds)) return 'Tomorrow';
  }
  return dateText(start);
}

/** "Tonight, 23:00 to 04:00". */
export function whenText(party: Pick<Party, 'startsAt' | 'endsAt'>, now: number): string {
  const from = timeText(party.startsAt);
  const to = timeText(party.endsAt);
  return joinParts([dayText(party, now), from && to ? `${from} to ${to}` : from, isOver(party, now) && 'ended']);
}

/** The label on a live party: "Live, 200+", or just "Live" while it is quiet. */
export function liveLabel(level: string | null | undefined): string {
  return !level || level === 'quiet' ? 'Live' : `Live, ${level}`;
}

/** The line under a large card's title: "Monkey, Techno, until 04:00, €5". */
export function cardLine(party: PartyListing): string {
  const until = timeText(party.endsAt);
  return joinParts([party.venueName, party.genre, until && `until ${until}`, priceText(party.price)]);
}

/**
 * The line under a compact row's title: "Kula, House, from 00:00" tonight,
 * "Fri, Kula, House, from 23:00" on a later day, "Kula, House, until 04:00" while it is on.
 */
export function rowLine(party: PartyListing, now: number): string {
  const start = Date.parse(party.startsAt);
  const from = timeText(party.startsAt);
  if (isOver(party, now)) return joinParts([dateText(party.startsAt), party.venueName, party.genre, 'ended']);
  if (start <= now) {
    const until = timeText(party.endsAt);
    return joinParts([party.venueName, party.genre, until && `until ${until}`]);
  }
  if (start < nightEnd(now)) return joinParts([party.venueName, party.genre, from && `from ${from}`]);
  // A bare weekday is only clear within the coming week.
  const day = start - now < 6 * DAY_MS ? weekdayText(start) : dateText(start);
  return joinParts([day, party.venueName, party.genre, from && `from ${from}`]);
}

/** What to say about the crowd on a row for a party that is on: "50+ expected", or "On now" with nothing known. */
export function onNowText(party: PartyListing): string {
  return crowdText(party.crowdLevel, party.crowdSource) ?? 'On now';
}

/** "22:00:00" from the server becomes "22:00". */
function hoursText(time: string | null | undefined): string {
  const match = time ? /^(\d{1,2}):(\d{2})/.exec(time) : null;
  return match ? `${two(Number(match[1]))}:${match[2]}` : '';
}

/** "Thu, Fri, Sat, 22:00 to 04:00" from a venue's working days ("Thu,Fri,Sat" or "THU,FRI,SAT") and hours. */
export function openingText(
  days: string | null | undefined,
  open: string | null | undefined,
  close: string | null | undefined,
): string {
  const dayWords = (days ?? '')
    .split(',')
    .map((day) => day.trim())
    .filter(Boolean)
    .map((day) => day.charAt(0).toUpperCase() + day.slice(1).toLowerCase());
  const from = hoursText(open);
  const to = hoursText(close);
  return joinParts([...dayWords, from && to ? `${from} to ${to}` : '']);
}

/** "23:00–04:00", the way a flyer writes it. Just the start when the end cannot be read. */
export function timeRangeText(party: Pick<Party, 'startsAt' | 'endsAt'>): string {
  const from = timeText(party.startsAt);
  const to = timeText(party.endsAt);
  return from && to ? `${from}–${to}` : from;
}

const WEEK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

/** "Thu–Sat" for a run of three days or more, else "Fri, Sat". Empty when no day can be read. */
export function openDaysText(days: string | null | undefined): string {
  const picked = [
    ...new Set(
      (days ?? '')
        .split(',')
        .map((day) => WEEK.indexOf(day.trim().slice(0, 3).toLowerCase() as (typeof WEEK)[number]))
        .filter((index) => index >= 0),
    ),
  ].sort((a, b) => a - b);
  if (picked.length === 0) return '';
  const word = (index: number) => WEEK[index].charAt(0).toUpperCase() + WEEK[index].slice(1);
  const run = picked.every((index, i) => i === 0 || index === picked[i - 1] + 1);
  if (run && picked.length >= 3) return `${word(picked[0])}–${word(picked[picked.length - 1])}`;
  return picked.map(word).join(', ');
}

/** Walking pace for "7 min walk": 80 metres a minute. */
const WALK_M_PER_MIN = 80;
/** Past this a walk is not the way to get there, so only the distance is given. */
const WALKABLE_M = 3000;

/** "550 m, 7 min walk", "1.4 km, 18 min walk", "6.2 km". */
export function distanceText(metres: number): string {
  if (!Number.isFinite(metres) || metres < 0) return '';
  const walk = `${Math.max(1, Math.round(metres / WALK_M_PER_MIN))} min walk`;
  if (metres < 1000) return `${Math.max(50, Math.round(metres / 50) * 50)} m, ${walk}`;
  const km = `${(metres / 1000).toFixed(1)} km`;
  return metres <= WALKABLE_M ? `${km}, ${walk}` : km;
}

/** Straight-line distance in metres between two points on the earth. */
export function metresBetween(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "open Thu–Sat, 22:00–04:00" for a venue's line, from its working days and hours. Empty when neither is known. */
export function openShortText(
  days: string | null | undefined,
  open: string | null | undefined,
  close: string | null | undefined,
): string {
  const dayWords = openDaysText(days);
  const from = hoursText(open);
  const to = hoursText(close);
  const hours = from && to ? `${from}–${to}` : '';
  const parts = joinParts([dayWords, hours]);
  return parts ? `open ${parts}` : '';
}
