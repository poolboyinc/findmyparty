// Draws the city's light sprites (beams, roof rings) the way the mock draws them
// (design-proposals/afterglow-concept.html, drawCity), and writes them as PNGs at 3×.
//
//   node --import ./tools/city-preview/hooks.mjs tools/city-preview/make-sprites.mjs
//
// The sizes here are the mock's, times 1.37 (the mock's screen is 286 pt wide, an iPhone 393 pt).
// `components/city/sprites.ts` holds the same numbers for the map; keep the two in step.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPage } from './chrome.mjs';

// The wording of the crowd line comes from the app, so the pictures cannot drift from it.
const { mapCrowdLabel } = await import('@/components/city/geojson');
const LEVELS = ['quiet', '20+', '50+', '100+', '200+'];

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '../../assets/images/city');
mkdirSync(out, { recursive: true });

const QUIET = [0x9d, 0x6b, 0xff];
const FULL = [0xec, 0x5b, 0x93];
const hex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
/** Violet when quiet, rose when full: the same ramp as services/crowd.ts. */
const crowdColor = (bars) => hex(QUIET.map((q, i) => q + (FULL[i] - q) * (Math.max(0, bars - 1) / 4)));

const sprites = [];
for (let bars = 0; bars <= 5; bars++) {
  const heat = bars / 5;
  const color = bars === 0 ? '#7d6bb8' : crowdColor(bars);
  sprites.push({ kind: 'beam', name: `beam-${bars}-live`, heat, color, hollow: false });
  sprites.push({ kind: 'beam', name: `beam-${bars}-expected`, heat, color, hollow: true });
  sprites.push({ kind: 'ring', name: `ring-${bars}`, color });
}
sprites.push({ kind: 'beam', name: 'beam-earned', heat: 0.45, color: '#c6ff3d', hollow: false });
sprites.push({ kind: 'ring', name: 'ring-earned', color: '#c6ff3d' });
sprites.push({ kind: 'ring', name: 'ring-selected', color: '#ffffff' });
sprites.push({ kind: 'ring', name: 'ring-ghost', color: '#ffffff', dashed: true });
// The amber block over a paid sign, and the ring a friend's initial sits in.
sprites.push({ kind: 'tag', name: 'ad-tag' });
sprites.push({ kind: 'friend', name: 'friend-ring' });
// The ripple that spreads from the roof of a busy venue: the ring again, twice as wide and thinner.
for (let bars = 3; bars <= 5; bars++) sprites.push({ kind: 'ring', name: `ping-${bars}`, color: crowdColor(bars), ping: true });
for (let bars = 1; bars <= 5; bars++) {
  for (const source of ['live', 'expected']) {
    sprites.push({ kind: 'count', name: `count-${bars}-${source}`, color: crowdColor(bars), text: mapCrowdLabel(LEVELS[bars - 1], source) });
  }
}

// Runs inside the page. Returns a PNG data URL and the sprite's size in points.
function draw(sprite) {
  const S = 1.37;
  const D = 3;
  const rgba = (h, a) => {
    const n = parseInt(h.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  };
  const canvas = document.createElement('canvas');
  let W;
  let H;
  const make = (w, h) => {
    W = Math.ceil(w);
    H = Math.ceil(h);
    canvas.width = W * D;
    canvas.height = H * D;
    const g = canvas.getContext('2d');
    g.scale(D, D);
    g.globalCompositeOperation = 'lighter';
    return g;
  };

  if (sprite.kind === 'beam') {
    const L = (26 + sprite.heat * 112) * S;
    const w = (1.8 + sprite.heat * 3) * S;
    const R = 22 * S;
    const top = 16;
    const g = make(2 * R + 4, top + L + R);
    const x = W / 2;
    const y = top + L;
    const col = sprite.color;
    const A = sprite.hollow ? 0.55 : 1;

    // The pool of light where the beam leaves the roof.
    const halo = g.createRadialGradient(x, y, 0, x, y, R);
    halo.addColorStop(0, rgba(col, 0.42 * A));
    halo.addColorStop(1, rgba(col, 0));
    g.fillStyle = halo;
    g.beginPath();
    g.arc(x, y, R, 0, 7);
    g.fill();

    // The beam: widest and brightest at the roof, fading to nothing.
    const fade = g.createLinearGradient(0, y, 0, y - L);
    fade.addColorStop(0, rgba(col, 0.95 * A));
    fade.addColorStop(0.55, rgba(col, 0.4 * A));
    fade.addColorStop(1, rgba(col, 0));
    const shape = () => {
      g.beginPath();
      g.moveTo(x - w, y);
      g.lineTo(x + w, y);
      g.lineTo(x + w * 0.3, y - L);
      g.lineTo(x - w * 0.3, y - L);
      g.closePath();
    };
    g.shadowColor = col;
    g.shadowBlur = 11 * S * D;
    if (sprite.hollow) {
      // Expected, not yet scanned: only the beam's outline.
      g.strokeStyle = fade;
      g.lineWidth = 1.1;
      shape();
      g.stroke();
      g.shadowBlur = 0;
      g.fillStyle = rgba(col, 0.1);
      shape();
      g.fill();
    } else {
      g.fillStyle = fade;
      shape();
      g.fill();
      g.shadowBlur = 0;
      const core = g.createLinearGradient(0, y, 0, y - L * 0.75);
      core.addColorStop(0, 'rgba(255,255,255,0.9)');
      core.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = core;
      g.fillRect(x - 0.7 * S, y - L * 0.75, 1.4 * S, L * 0.75);
    }
    return { url: canvas.toDataURL('image/png'), width: W, height: H, length: L, halo: R };
  }

  if (sprite.kind === 'tag') {
    // The mock's `.adtag`: a small amber block, dark "Ad", barely rounded.
    const g = make(17, 11);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#ffb020';
    g.beginPath();
    g.roundRect(0, 0, W, H, 2);
    g.fill();
    g.font = `700 ${6.5 * S}px "Adwaita Sans", "Inter", system-ui, sans-serif`;
    g.fillStyle = '#1a0f00';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('Ad', W / 2, H / 2 + 0.5);
    return { url: canvas.toDataURL('image/png'), width: W, height: H };
  }

  if (sprite.kind === 'friend') {
    // The mock's `.av`: a dark disc with a cyan ring; the friend's initial is set on top by the map.
    const g = make(24, 24);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#0b1a24';
    g.strokeStyle = '#22e6ff';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(12, 12, 10, 0, 7);
    g.fill();
    g.stroke();
    return { url: canvas.toDataURL('image/png'), width: W, height: H };
  }

  if (sprite.kind === 'count') {
    // The crowd under a venue's name: small, semi-bold, in the venue's colour, with a dark edge
    // so it reads on the map (the mock's `.vt small`: 7.5 px × 1.37).
    const size = 7.5 * S;
    const font = `650 ${size}px "Adwaita Sans", "Inter", system-ui, sans-serif`;
    const probe = document.createElement('canvas').getContext('2d');
    probe.font = font;
    const g = make(probe.measureText(sprite.text).width + 10, 15);
    g.globalCompositeOperation = 'source-over';
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(7,6,13,0.85)';
    g.lineWidth = 2.6;
    g.shadowColor = 'rgba(7,6,13,0.9)';
    g.shadowBlur = 3 * D;
    g.strokeText(sprite.text, W / 2, H / 2 + 0.5);
    g.shadowBlur = 0;
    g.fillStyle = sprite.color;
    g.fillText(sprite.text, W / 2, H / 2 + 0.5);
    return { url: canvas.toDataURL('image/png'), width: W, height: H };
  }

  // A ring that lies on the roof: drawn as a circle, the map lays it flat.
  const r = 8.5 * S * (sprite.ping ? 2 : 1);
  const pad = 9;
  const g = make(2 * (r + pad), 2 * (r + pad));
  const c = W / 2;
  g.shadowColor = sprite.color;
  g.shadowBlur = 7 * S * D;
  g.strokeStyle = rgba(sprite.color, sprite.dashed ? 0.45 : sprite.ping ? 0.7 : 0.95);
  g.lineWidth = sprite.dashed || sprite.ping ? 1.1 : 1.7;
  if (sprite.dashed) {
    g.shadowBlur = 0;
    g.setLineDash([3, 3]);
  }
  g.beginPath();
  g.arc(c, c, r, 0, 7);
  g.stroke();
  return { url: canvas.toDataURL('image/png'), width: W, height: H };
}

const page = await openPage({ width: 400, height: 400, scale: 1, port: 9334 });
try {
  const sizes = {};
  for (const sprite of sprites) {
    const result = await page.run(`(${draw.toString()})(${JSON.stringify(sprite)})`);
    writeFileSync(join(out, `${sprite.name}.png`), Buffer.from(result.url.split(',')[1], 'base64'));
    sizes[sprite.name] = { width: result.width, height: result.height, length: result.length, halo: result.halo };
  }
  console.log(JSON.stringify(sizes, null, 1));

  // The list the app loads the pictures from: Metro needs every `require` written out.
  const names = sprites.map((sprite) => sprite.name).sort();
  writeFileSync(
    join(here, '../../components/city/city-images.ts'),
    `// The light pictures, by the names the map layers use (components/city/sprites.ts).
// Written by tools/city-preview/make-sprites.mjs: do not edit by hand.

import { LABEL_BOX, LABEL_BOX_IMAGE, SPRITE } from './constants';

const FILES = {
${names.map((name) => `  '${name}': require('@/assets/images/city/${name}.png'),`).join('\n')}
} as const;

/** Ready for the map's \`<Images>\`: each picture with its pixels-per-point. */
export const SPRITE_IMAGES = {
  ...Object.fromEntries(Object.entries(FILES).map(([name, image]) => [name, { image, scale: SPRITE.pixelRatio }])),
  [LABEL_BOX_IMAGE]: {
    image: require('@/assets/images/city/label-box.png'),
    scale: LABEL_BOX.pixelRatio,
    stretchX: LABEL_BOX.stretch,
    stretchY: LABEL_BOX.stretch,
  },
};
`,
  );
} finally {
  await page.close();
}
