// What the map's filter square narrows the venues to (`MapFilterSheet`). Pure (no React Native imports),
// so it runs in plain Node. The shape is the one the City screen keeps (`MapFilter` in components/city/city-lines.ts),
// so the sheet takes the map's `filter` and `setFilter` as they are.
import type { VenueSummary } from '../../types/api.ts';
import type { MapFilter } from '../city/city-lines.ts';
import { matchesTaste } from './feed.ts';

/** The shape the City screen keeps (For you, Free entry, one genre); defined with the map, used as it is. */
export type { MapFilter };

export const EMPTY_MAP_FILTER: MapFilter = { forYou: false, freeEntry: false, genre: null };

/** How many of the three are on, for a count on the filter square. 0 when the filter is off. */
export function mapFilterCount(filter: MapFilter): number {
  return (filter.forYou ? 1 : 0) + (filter.freeEntry ? 1 : 0) + (filter.genre ? 1 : 0);
}

export function isMapFilterOn(filter: MapFilter): boolean {
  return mapFilterCount(filter) > 0;
}

/** Picks a genre, or clears it when it was the one picked. */
export function toggleGenre(filter: MapFilter, genre: string): MapFilter {
  return { ...filter, genre: filter.genre === genre ? null : genre };
}

/**
 * Whether a party with this genre and price passes. Every part that is on must hold. "For you" with no sound
 * picked lets everything through (the sheet hides it then).
 */
export function partyMatchesMapFilter(
  party: { genre: string | null | undefined; price: number | null | undefined },
  filter: MapFilter,
  taste: readonly string[],
): boolean {
  if (filter.forYou && taste.length > 0 && !matchesTaste(party.genre, taste)) return false;
  if (filter.freeEntry && (party.price === null || party.price === undefined || party.price > 0)) return false;
  if (filter.genre && !matchesTaste(party.genre, [filter.genre])) return false;
  return true;
}

/**
 * Whether a venue stays on the map: judged by its party (on now or next). With the filter on, a venue with
 * no party is left out.
 */
export function venueMatchesMapFilter(
  venue: Pick<VenueSummary, 'partyId' | 'partyGenre' | 'partyPrice'>,
  filter: MapFilter,
  taste: readonly string[],
): boolean {
  if (!isMapFilterOn(filter)) return true;
  if (!venue.partyId) return false;
  return partyMatchesMapFilter({ genre: venue.partyGenre, price: venue.partyPrice }, filter, taste);
}
