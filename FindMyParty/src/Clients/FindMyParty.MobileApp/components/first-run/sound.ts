import { TASTE_ORDER } from '@/constants/parties';

/** The genres a guest can pick, in the order the pads are drawn (S-02). The server accepts exactly these. */
export const TASTE_GENRES: readonly string[] = TASTE_ORDER;

/** The "Your sound" bars: the first three picks, widest first, in the mock's 5 : 3 : 2. */
export const SOUND_WEIGHTS = [5, 3, 2] as const;

/** Picks after tapping `genre`: added at the end, or taken out. Pick order is kept. */
export function togglePick(picks: readonly string[], genre: string): string[] {
  return picks.includes(genre) ? picks.filter((pick) => pick !== genre) : [...picks, genre];
}

/** Picks the server will take: known genres only, each once, in pick order. */
export function knownPicks(picks: readonly string[]): string[] {
  return [...new Set(picks.filter((genre) => TASTE_GENRES.includes(genre)))];
}
