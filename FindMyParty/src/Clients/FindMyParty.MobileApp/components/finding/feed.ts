// What the Tonight feed shows and in which section. Pure (no React Native imports), so it runs in plain Node.
import { crowdBars } from '../../services/crowd.ts';
import type { City, Party } from '../../types/api.ts';
import { isOver, nightEnd } from './format.ts';

/** The chips on Tonight, in order. Tapping the chip that is on turns it off, which shows everything ('All'). */
export const FILTERS = ['Tonight', 'For you', 'Free entry', 'Weekend'] as const;
export type Filter = (typeof FILTERS)[number] | 'All';
/** The screen is called Tonight, so that is where it opens. */
export const DEFAULT_FILTER: Filter = 'Tonight';

const HOUR_MS = 60 * 60_000;
const FRIDAY = 5;
/** The weekend starts on Friday evening and runs to the end of Sunday night (six on Monday morning). */
const WEEKEND_STARTS_AT_HOUR = 17;
const WEEKEND_HOURS = 7 + 24 + 24 + 6;

/** Title, venue name and genre, ignoring case. An empty search matches everything. */
export function matchesSearch(party: Party, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${party.title} ${party.venueName ?? ''} ${party.genre ?? ''}`.toLowerCase().includes(q);
}

/** The weekend that `now` is in, or the next one. */
function weekend(now: number): { from: number; to: number } {
  const d = new Date(now);
  const friday = new Date(d.getFullYear(), d.getMonth(), d.getDate(), WEEKEND_STARTS_AT_HOUR);
  friday.setDate(friday.getDate() - ((d.getDay() - FRIDAY + 7) % 7));
  let from = friday.getTime();
  // Monday to Friday afternoon: last weekend is over, so look at the coming one.
  if (from + WEEKEND_HOURS * HOUR_MS <= now) {
    friday.setDate(friday.getDate() + 7);
    from = friday.getTime();
  }
  return { from, to: from + WEEKEND_HOURS * HOUR_MS };
}

/** The party's genre is one the user picked as their sound (`useTaste()`), ignoring case. */
export function matchesTaste(genre: string | null | undefined, taste: readonly string[]): boolean {
  const g = genre?.trim().toLowerCase();
  return !!g && taste.some((picked) => picked.trim().toLowerCase() === g);
}

export function matchesFilter(party: Party, filter: Filter, now: number, taste: readonly string[] = []): boolean {
  const start = Date.parse(party.startsAt);
  const end = Date.parse(party.endsAt);
  switch (filter) {
    case 'Tonight':
      return start < nightEnd(now) && end > now;
    case 'For you':
      return matchesTaste(party.genre, taste);
    case 'Free entry':
      return !(party.price > 0);
    case 'Weekend': {
      const { from, to } = weekend(now);
      return start < to && end > Math.max(from, now);
    }
    default:
      return true;
  }
}

/**
 * The city's name for "Fri 13 Nov, Podgorica": the server's name once the cities have loaded, before that the
 * slug written as a name ("herceg-novi" → "Herceg Novi").
 */
export function cityName(slug: string, city: Pick<City, 'slug' | 'name'> | null | undefined): string {
  if (city && city.slug === slug && city.name.trim()) return city.name;
  return slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * A paid slot is an ordinary row: it is moved to the second row of its section (or the first, when it is the
 * only row). With two, they take the second and third rows in their own order. The rest keep their order.
 */
export function placeSponsored<T extends Pick<Party, 'sponsored'>>(rows: readonly T[]): T[] {
  const paid = rows.filter((row) => row.sponsored === true);
  if (paid.length === 0) return [...rows];
  const rest = rows.filter((row) => row.sponsored !== true);
  if (rest.length === 0) return paid;
  return [rest[0], ...paid, ...rest.slice(1)];
}

export interface Feed {
  /** On now with guests scanned in, busiest first. */
  glowing: Party[];
  /** On now but nobody scanned yet, then everything that starts before the night ends. */
  later: Party[];
  /** After tonight. */
  comingUp: Party[];
}

export function splitFeed(parties: readonly Party[], now: number): Feed {
  const glowing: Party[] = [];
  const onNow: Party[] = [];
  const later: Party[] = [];
  const comingUp: Party[] = [];
  const tonightEnds = nightEnd(now);

  const soonestFirst = [...parties].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  for (const party of soonestFirst) {
    const start = Date.parse(party.startsAt);
    if (Number.isNaN(start) || isOver(party, now)) continue;
    if (start <= now) (party.crowdSource === 'live' ? glowing : onNow).push(party);
    else if (start < tonightEnds) later.push(party);
    else comingUp.push(party);
  }

  // A glowing party stays where its heat puts it, sponsored or not; elsewhere a paid slot is the second row.
  glowing.sort((a, b) => crowdBars(b.crowdLevel) - crowdBars(a.crowdLevel));
  return { glowing, later: placeSponsored([...onNow, ...later]), comingUp: placeSponsored(comingUp) };
}
