// Names and sizes of the light pictures the map stands on venues. Pure: no React, no map.
// The pictures are drawn by tools/city-preview/make-sprites.mjs; the numbers here mirror that file.

import { SPRITE } from './constants';

/** Points from a beam's foot to its tip at size 1, for a heat of 0–1 (the mock's `26 + heat × 112`). */
export function beamLengthPt(heat: number): number {
  return (26 + Math.min(1, Math.max(0, heat)) * 112) * SPRITE.mockScale;
}

/** The beam for a crowd of `bars` (0 nothing known … 5 full). Expected crowds get the hollow beam. */
export function beamImage(bars: number, expected: boolean): string {
  return `beam-${clampBars(bars)}-${expected ? 'expected' : 'live'}`;
}

/** The ring on the roof, in the same colour as the beam. */
export function ringImage(bars: number): string {
  return `ring-${clampBars(bars)}`;
}

/** The crowd line under a name ("200+", "50+ expected"), as a small picture in the venue's colour. */
export function countImage(bars: number, expected: boolean): string {
  return `count-${clampBars(bars)}-${expected ? 'expected' : 'live'}`;
}

/** The ripple from the roof of a busy venue ('' for venues that are not busy enough to pulse). */
export function pingImage(bars: number): string {
  return bars >= PING_FROM_BARS ? `ping-${clampBars(bars)}` : '';
}
const PING_FROM_BARS = 3;

/** The amber "Ad" block over a paid sign, and the ring a friend's initial sits in. */
export const AD_TAG = 'ad-tag';
export const FRIEND_RING = 'friend-ring';

export const BEAM_EARNED = 'beam-earned';
export const RING_EARNED = 'ring-earned';
export const RING_SELECTED = 'ring-selected';
export const RING_GHOST = 'ring-ghost';

function clampBars(bars: number): number {
  return Math.min(5, Math.max(0, Math.round(bars)));
}

const BARS = [0, 1, 2, 3, 4, 5];

/** Every picture the venue layers may ask for; city-images.ts must provide each one. */
export const SPRITE_NAMES: readonly string[] = [
  ...BARS.flatMap((bars) => [beamImage(bars, false), beamImage(bars, true), ringImage(bars)]),
  ...BARS.slice(1).flatMap((bars) => [countImage(bars, false), countImage(bars, true)]),
  ...BARS.map(pingImage).filter(Boolean),
  AD_TAG,
  FRIEND_RING,
  BEAM_EARNED,
  RING_EARNED,
  RING_SELECTED,
  RING_GHOST,
];
