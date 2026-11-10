// How a crowd level from the server is shown. Pure, tested in services/__tests__/crowd.test.mjs.
// The server sends a range ("quiet", "20+", "50+", "100+", "200+") and where it comes from:
// "live" (guests scanned in at the door) or "expected" (passes taken, nobody scanned yet).

export type CrowdLevel = 'quiet' | '20+' | '50+' | '100+' | '200+';
export type CrowdSource = 'live' | 'expected';

const ORDER: readonly string[] = ['quiet', '20+', '50+', '100+', '200+'];
const QUIET = [0x9d, 0x6b, 0xff]; // theme colors.quiet
const FULL = [0xec, 0x5b, 0x93]; // theme colors.crowd

/** Bars to light, out of five. 0 when there is no information. */
export function crowdBars(level: string | null | undefined): number {
  if (!level) return 0;
  const index = ORDER.indexOf(level);
  return index === -1 ? 1 : index + 1;
}

/** 0–1: how tall and bright a venue's beam is. */
export function crowdStrength(level: string | null | undefined): number {
  return crowdBars(level) / 5;
}

/** Violet when quiet, rose when full. */
export function crowdColor(level: string | null | undefined): string {
  const t = Math.max(0, crowdBars(level) - 1) / 4;
  return '#' + QUIET.map((q, i) => Math.round(q + (FULL[i] - q) * t).toString(16).padStart(2, '0')).join('');
}

/** A short line for cards and labels, or null when there is nothing to say. */
export function crowdText(level: string | null | undefined, source: string | null | undefined): string | null {
  if (!level) return null;
  const live = source === 'live';
  if (level === 'quiet') return live ? 'Quiet right now' : 'Quiet so far';
  return live ? `${level} inside now` : `${level} expected`;
}
