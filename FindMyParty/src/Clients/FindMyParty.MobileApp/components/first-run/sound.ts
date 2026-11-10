import { PARTY_GENRES } from '@/constants/parties';

/** The genres a guest can pick: the host form's list without "Other", which says nothing about a sound. */
export const TASTE_GENRES: readonly string[] = PARTY_GENRES.filter((genre) => genre !== 'Other');

/** The "Your sound" bars: the first three picks, widest first, in the mock's 5 : 3 : 2. */
export const SOUND_WEIGHTS = [5, 3, 2] as const;

/** Picks after tapping `genre`: added at the end, or taken out. Pick order is kept. */
export function togglePick(picks: readonly string[], genre: string): string[] {
  return picks.includes(genre) ? picks.filter((pick) => pick !== genre) : [...picks, genre];
}
