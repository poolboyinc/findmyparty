// What the search sheet finds among the venues and parties already loaded for the city.
// Pure (no React Native imports), so it runs in plain Node.
import type { Party, VenueSummary } from '../../types/api.ts';
import { crowdBars } from '../../services/crowd.ts';
import { isOver } from './format.ts';

/** Lower case, without accents, so "stara varos" finds "Stara Varoš" and "dr house" finds "Dr. House". */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'dj')
    .replace(/Đ/g, 'Dj')
    .toLowerCase()
    .replace(/[^a-z0-9+&]+/g, ' ')
    .trim();
}

/** Every word of the query starts a word somewhere in the text. */
function matches(haystack: string, words: readonly string[]): boolean {
  const own = ` ${haystack}`;
  return words.every((word) => own.includes(` ${word}`));
}

export interface SearchResults {
  venues: VenueSummary[];
  parties: Party[];
}

export const SEARCH_LIMITS = { venues: 6, parties: 12 } as const;

/**
 * Venues by name, kind, area and their party; parties by title, venue, genre, area and line-up. Ended parties
 * are left out. With no query: every venue, busiest first, and the parties soonest first, both cut to the limits.
 */
export function searchCity(
  venues: readonly VenueSummary[],
  parties: readonly Party[],
  query: string,
  now: number,
): SearchResults {
  const words = fold(query).split(' ').filter(Boolean);
  const open = parties.filter((party) => !isOver(party, now));

  const venueHits = venues.filter((venue) =>
    matches(fold([venue.name, venue.kind, venue.area, venue.partyTitle, venue.partyGenre, venue.partyLineupText].join(' ')), words),
  );
  const partyHits = open.filter((party) =>
    matches(fold([party.title, party.venueName, party.genre, party.venueArea, party.lineupText].join(' ')), words),
  );

  // A name that starts with the query comes first; then the busiest venue, the soonest party.
  const leads = (name: string) => (words.length > 0 && fold(name).startsWith(words.join(' ')) ? 0 : 1);
  venueHits.sort(
    (a, b) => leads(a.name) - leads(b.name) || crowdBars(b.crowdLevel) - crowdBars(a.crowdLevel) || a.name.localeCompare(b.name),
  );
  partyHits.sort((a, b) => leads(a.title) - leads(b.title) || Date.parse(a.startsAt) - Date.parse(b.startsAt));

  return { venues: venueHits.slice(0, SEARCH_LIMITS.venues), parties: partyHits.slice(0, SEARCH_LIMITS.parties) };
}
