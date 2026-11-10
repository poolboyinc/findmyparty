import type { VenueSummary } from '@/types/api';

/** The least number of people each crowd range stands for. "quiet" says nothing about a number. */
const RANGE_FLOOR: Record<string, number> = { quiet: 0, '20+': 20, '50+': 50, '100+': 100, '200+': 200 };

/**
 * The rose line on the welcome (S-01), from the venues' live crowds only (people scanned in at the door):
 * "270+ out tonight in Podgorica", the sum of each live range's floor, so it never overstates. With live
 * venues but no number yet it counts venues; with nothing live it is null and the line stays out.
 */
export function outTonightLine(venues: readonly Pick<VenueSummary, 'crowdLevel' | 'crowdSource'>[], city: string): string | null {
  const live = venues.filter((venue) => venue.crowdSource === 'live' && venue.crowdLevel);
  if (live.length === 0) return null;
  const people = live.reduce((sum, venue) => sum + (RANGE_FLOOR[venue.crowdLevel ?? ''] ?? 0), 0);
  if (people > 0) return `${String(people).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}+ out tonight in ${city}`;
  return live.length === 1 ? `1 venue lit tonight in ${city}` : `${live.length} venues lit tonight in ${city}`;
}
