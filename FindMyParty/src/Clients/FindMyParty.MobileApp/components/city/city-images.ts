// The light pictures, by the names the map layers use (components/city/sprites.ts).
// Written by tools/city-preview/make-sprites.mjs: do not edit by hand.

import { LABEL_BOX, LABEL_BOX_IMAGE, SPRITE } from './constants';

const FILES = {
  'ad-tag': require('@/assets/images/city/ad-tag.png'),
  'beam-0-expected': require('@/assets/images/city/beam-0-expected.png'),
  'beam-0-live': require('@/assets/images/city/beam-0-live.png'),
  'beam-1-expected': require('@/assets/images/city/beam-1-expected.png'),
  'beam-1-live': require('@/assets/images/city/beam-1-live.png'),
  'beam-2-expected': require('@/assets/images/city/beam-2-expected.png'),
  'beam-2-live': require('@/assets/images/city/beam-2-live.png'),
  'beam-3-expected': require('@/assets/images/city/beam-3-expected.png'),
  'beam-3-live': require('@/assets/images/city/beam-3-live.png'),
  'beam-4-expected': require('@/assets/images/city/beam-4-expected.png'),
  'beam-4-live': require('@/assets/images/city/beam-4-live.png'),
  'beam-5-expected': require('@/assets/images/city/beam-5-expected.png'),
  'beam-5-live': require('@/assets/images/city/beam-5-live.png'),
  'beam-earned': require('@/assets/images/city/beam-earned.png'),
  'count-1-expected': require('@/assets/images/city/count-1-expected.png'),
  'count-1-live': require('@/assets/images/city/count-1-live.png'),
  'count-2-expected': require('@/assets/images/city/count-2-expected.png'),
  'count-2-live': require('@/assets/images/city/count-2-live.png'),
  'count-3-expected': require('@/assets/images/city/count-3-expected.png'),
  'count-3-live': require('@/assets/images/city/count-3-live.png'),
  'count-4-expected': require('@/assets/images/city/count-4-expected.png'),
  'count-4-live': require('@/assets/images/city/count-4-live.png'),
  'count-5-expected': require('@/assets/images/city/count-5-expected.png'),
  'count-5-live': require('@/assets/images/city/count-5-live.png'),
  'friend-ring': require('@/assets/images/city/friend-ring.png'),
  'ping-3': require('@/assets/images/city/ping-3.png'),
  'ping-4': require('@/assets/images/city/ping-4.png'),
  'ping-5': require('@/assets/images/city/ping-5.png'),
  'ring-0': require('@/assets/images/city/ring-0.png'),
  'ring-1': require('@/assets/images/city/ring-1.png'),
  'ring-2': require('@/assets/images/city/ring-2.png'),
  'ring-3': require('@/assets/images/city/ring-3.png'),
  'ring-4': require('@/assets/images/city/ring-4.png'),
  'ring-5': require('@/assets/images/city/ring-5.png'),
  'ring-earned': require('@/assets/images/city/ring-earned.png'),
  'ring-ghost': require('@/assets/images/city/ring-ghost.png'),
  'ring-selected': require('@/assets/images/city/ring-selected.png'),
} as const;

/** Ready for the map's `<Images>`: each picture with its pixels-per-point. */
export const SPRITE_IMAGES = {
  ...Object.fromEntries(Object.entries(FILES).map(([name, image]) => [name, { image, scale: SPRITE.pixelRatio }])),
  [LABEL_BOX_IMAGE]: {
    image: require('@/assets/images/city/label-box.png'),
    scale: LABEL_BOX.pixelRatio,
    stretchX: LABEL_BOX.stretch,
    stretchY: LABEL_BOX.stretch,
  },
};
