// Draws the City tab's map in headless Chrome, from the very layer list the app uses
// (components/city/layers.ts), and saves pictures of it. A way to look at the city without a phone.
//
//   node --import ./tools/city-preview/hooks.mjs tools/city-preview/preview.mjs [shot …]
//
// Shots are named in SHOTS below; with none given, all are taken. Pictures land in /tmp/city-preview.
// Mapbox GL JS and the iOS SDK share one style language but not one renderer: treat the pictures
// as a close guide, not as proof.
import { mkdirSync, readFileSync } from 'node:fs';
import http from 'node:http';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPage } from './chrome.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, '../..');
const out = process.env.OUT ?? '/tmp/city-preview';
mkdirSync(out, { recursive: true });

const C = await import('@/components/city/constants');
const { cityLayers, friendLayers, pingLayers, signLayers, venueLayers } = await import('@/components/city/layers');
const { signArtUrl, signFeatures, signImageName } = await import('@/components/city/signs');
const { decodeSignArt, drawFace, drawHologram, quadGlb } = await import('./sign-art.mjs');
const { friendMarks, venuePoints, venueShapes } = await import('@/components/city/geojson');
const { pickFootprint } = await import('@/components/city/footprint');
const { ATMOSPHERE_STYLE } = await import('@/components/city/layer-styles');
const { SPRITE_NAMES } = await import('@/components/city/sprites');

const eas = JSON.parse(readFileSync(join(app, 'eas.json'), 'utf8'));
const env = Object.values(eas.build).map((b) => b.env ?? {}).find((e) => e.EXPO_PUBLIC_MAPBOX_TOKEN) ?? {};
const token = process.env.MAPBOX_TOKEN ?? env.EXPO_PUBLIC_MAPBOX_TOKEN;
const api = process.env.API_URL ?? env.EXPO_PUBLIC_API_URL ?? 'https://findmyparty-api-production.up.railway.app';
if (!token) throw new Error('No Mapbox token: set MAPBOX_TOKEN or put EXPO_PUBLIC_MAPBOX_TOKEN in eas.json');

const venues = await (await fetch(`${api.replace(/\/$/, '')}/api/venues`)).json();
// PLACE='{"Monkey":[19.2649,42.4398]}' tries venues somewhere else without touching the server.
for (const [name, [longitude, latitude]] of Object.entries(JSON.parse(process.env.PLACE ?? '{}'))) {
  const venue = venues.find((v) => v.name === name);
  if (venue) Object.assign(venue, { longitude, latitude });
}
const byName = (name) => venues.find((v) => v.name === name);

// Signs to try: SIGNS=<file.json> (an array like the API's MapSign[]), else three on real walls
// near the demo venues: a paid panel, a venue's own, a hologram.
const DEMO_SIGNS = [
  { id: 'volt', format: 'facade', own: false, text: 'VOLT', colorTop: '#ffd23c', colorBottom: '#ff7a18', ink: '#1a0a00',
    spot: { longitude: 19.263993, latitude: 42.440313, bearingDeg: 202, baseHeightM: 5, widthM: 14, heightM: 9, buildingHeightM: 17 } },
  { id: 'kula', format: 'facade', own: true, text: 'KULA', colorTop: '#3a1bd6', colorBottom: '#ec5b93', ink: '#ffffff',
    spot: { longitude: 19.264919, latitude: 42.441174, bearingDeg: 202, baseHeightM: 8, widthM: 12, heightM: 7, buildingHeightM: 20 } },
  { id: 'aura', format: 'hologram', own: false, text: 'AURA|SPRITZ', colorTop: '#ffb020', colorBottom: '#ffb020', ink: '#ffb020',
    spot: { longitude: 19.26287, latitude: 42.44072, bearingDeg: 0, baseHeightM: 0, widthM: 10, heightM: 5, buildingHeightM: 17 } },
];
const signs = process.env.SIGNS === '0' ? [] : process.env.SIGNS ? JSON.parse(readFileSync(process.env.SIGNS, 'utf8')) : DEMO_SIGNS;

const DEFAULT = { center: C.CITY.center, zoom: C.CAMERA.zoom, pitch: C.CAMERA.pitch, bearing: C.CAMERA.heading };
const at = (name) => {
  const v = byName(name);
  return v ? [v.longitude, v.latitude] : C.CITY.center;
};

/** name → camera and what is selected / which mode. */
const SHOTS = {
  default: { camera: DEFAULT },
  selected: { camera: DEFAULT, select: 'Monkey' },
  near: { camera: { ...DEFAULT, center: at('Monkey'), zoom: 16.6 } },
  signs: { camera: { ...DEFAULT, center: [19.2639, 42.4406], zoom: 17.4 } },
  close: { camera: { ...DEFAULT, center: at('Monkey'), zoom: 17.8 }, select: 'Monkey' },
  far: { camera: { ...DEFAULT, zoom: 13.8 } },
  mine: { camera: DEFAULT, mode: 'mine', earned: ['Monkey', 'Kula'] },
  friends: {
    camera: DEFAULT,
    mode: 'friends',
    friends: [
      { venue: 'Dr. House', count: 3, initials: ['M', 'A', 'S'] },
      { venue: 'Neon Bašta', count: 1, initials: ['L'] },
      { venue: 'Blok 5', count: 1, initials: ['D'] },
    ],
  },
  flat: { camera: { ...DEFAULT, pitch: 0, bearing: 0, zoom: 15.6 }, flat: true },
  backdrop: {
    camera: {
      center: C.BACKDROP_CAMERA.center,
      zoom: C.BACKDROP_CAMERA.zoom,
      pitch: C.BACKDROP_CAMERA.pitch,
      bearing: C.BACKDROP_CAMERA.heading,
      padding: { top: C.BACKDROP_CAMERA.paddingTop, bottom: 0, left: 0, right: 0 },
    },
    labels: false,
  },
};
const wanted = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const shots = (wanted.length ? wanted : Object.keys(SHOTS)).map((name) => {
  // "z14.5" is the default view at that zoom; "Monkey@17" looks at a venue from that zoom.
  if (/^z[\d.]+$/.test(name)) return [name, { camera: { ...DEFAULT, zoom: Number(name.slice(1)) } }];
  const [venue, zoom] = name.split('@');
  if (zoom && byName(venue)) return [name, { camera: { ...DEFAULT, center: at(venue), zoom: Number(zoom) }, select: process.env.SELECT ? venue : undefined }];
  if (!SHOTS[name]) throw new Error(`No shot called ${name}. There are: ${Object.keys(SHOTS).join(', ')}`);
  return [name, SHOTS[name]];
});

// ── A tiny web server for the page and the app's images ─────────────────────
const MIME = { '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.glb': 'model/gltf-binary' };
let page = null;
const server = http
  .createServer(async (request, response) => {
    const path = new URL(request.url, 'http://x').pathname;
    response.setHeader('access-control-allow-origin', '*');
    try {
      // Standing in for the server's sign-art endpoints, drawn by the reference in sign-art.mjs.
      const art = path.match(/^\/api\/sign-art\/(face|hologram|panel)\/([A-Za-z0-9_-]+)\.(png|glb)$/);
      if (art) {
        const sign = decodeSignArt(art[2]);
        const draw = art[1] === 'hologram' ? drawHologram : drawFace;
        const url = await page.run(`(${draw.toString()})(${JSON.stringify(sign)})`);
        const png = Buffer.from(url.split(',')[1], 'base64');
        response.setHeader('content-type', MIME[`.${art[3]}`]);
        response.end(art[1] === 'panel' ? quadGlb(png) : png);
        return;
      }
      if (path === '/fonts/coolvetica.ttf') {
        response.setHeader('content-type', MIME['.ttf']);
        response.end(readFileSync(join(app, 'assets/fonts/coolvetica.ttf')));
        return;
      }
      const file = path === '/' ? join(here, 'page.html') : join(app, 'assets/images', path.replace(/^\/images\//, '').replace(/\.\./g, ''));
      response.setHeader('content-type', MIME[extname(file)] ?? 'application/octet-stream');
      response.end(readFileSync(file));
    } catch {
      response.statusCode = 404;
      response.end();
    }
  })
  .listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

const kebab = (name) => name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
const fog = C.SWITCH.atmosphere ? Object.fromEntries(Object.entries(ATMOSPHERE_STYLE).map(([k, v]) => [kebab(k), v])) : null;
const images = [
  { name: C.FACADE_IMAGE, url: `${base}/images/city-facade.png`, pixelRatio: C.FACADE_IMAGE_SCALE },
  {
    name: C.LABEL_BOX_IMAGE,
    url: `${base}/images/city/label-box.png`,
    pixelRatio: C.LABEL_BOX.pixelRatio,
    // The app gives the stretch in points; Mapbox GL JS wants pixels.
    stretchX: C.LABEL_BOX.stretch.map((pair) => pair.map((v) => v * C.LABEL_BOX.pixelRatio)),
    stretchY: C.LABEL_BOX.stretch.map((pair) => pair.map((v) => v * C.LABEL_BOX.pixelRatio)),
  },
  ...SPRITE_NAMES.map((name) => ({ name, url: `${base}/images/city/${name}.png`, pixelRatio: C.SPRITE.pixelRatio })),
];

page = await openPage();
const footprints = {};
try {
  await page.goto(`${base}/`);
  await new Promise((resolve) => setTimeout(resolve, 1200));

  let started = false;
  for (const [name, shot] of shots) {
    const flat = shot.flat ?? false;
    const drawing = () => ({
      selectedId: shot.select ? byName(shot.select)?.id ?? null : null,
      mode: shot.mode ?? 'live',
      earned: new Set((shot.earned ?? []).map((n) => byName(n)?.id)),
      flat,
      footprints,
    });
    const sources = () => {
      const points = venuePoints(venues, drawing());
      return {
        [C.SOURCE.venuePoints]: points,
        [C.SOURCE.venueShapes]: venueShapes(venues, drawing()),
        [C.SOURCE.venueLights]: points,
        [C.SOURCE.friends]: friendMarks(friends, footprints, flat),
        [C.SOURCE.signSlabs]: signData.slabs,
        [C.SOURCE.signPanels]: signData.panels,
        [C.SOURCE.signMarks]: signData.marks,
      };
    };
    const friendsMode = shot.mode === 'friends';
    const groups = venueLayers(flat, (shot.labels ?? true) && !friendsMode, friendsMode);
    const friends = (shot.friends ?? []).flatMap((f) => {
      const venue = byName(f.venue);
      return venue
        ? [{ venueId: venue.id, venueName: venue.name, latitude: venue.latitude, longitude: venue.longitude, count: f.count, friends: f.initials.map((initial) => ({ initial })) }]
        : [];
    });
    // PULSE=1 shows the second ripple of the pulse, as if caught mid-beat.
    const signGroups = signLayers();
    const shownSigns = flat ? [] : signs;
    const signData = signFeatures(shownSigns, C.BUILDINGS.stretch);
    const layers = [
      ...cityLayers(),
      ...groups.ground,
      ...groups.shapes,
      ...signGroups.slabs,
      ...signGroups.panels,
      ...pingLayers(flat, Number(process.env.PULSE ?? 3)),
      ...groups.lights,
      ...friendLayers(),
      ...signGroups.marks,
    ];
    const signImages = shownSigns.filter((sign) => sign.format === 'hologram').map((sign) => ({ name: signImageName(sign), url: signArtUrl(base, sign, 'hologram'), pixelRatio: 3 }));
    const signModels = shownSigns.filter((sign) => sign.format !== 'hologram').map((sign) => ({ name: signImageName(sign), url: signArtUrl(base, sign, 'panel') }));

    if (!started) {
      await page.run(`start(${JSON.stringify({ token, styleUrl: C.MAP_STYLE_URL.replace('mapbox://styles/', 'mapbox://styles/'), camera: shot.camera })})`);
      started = true;
    } else {
      await page.run(`moveTo(${JSON.stringify(shot.camera)})`);
    }
    const problems = await page.run(`dress(${JSON.stringify({ images: [...images, ...signImages], models: signModels, fog, layers, sources: sources() })})`);

    // As the app does when the map settles: find each venue's own building, then draw again.
    let found = 0;
    for (const venue of venues) {
      if (footprints[venue.id]) continue;
      const features = await page.run(`buildingsNear(${JSON.stringify([venue.longitude, venue.latitude])}, ${JSON.stringify(C.LAYER.buildings)}, 60)`);
      const footprint = pickFootprint([venue.longitude, venue.latitude], features);
      if (footprint) {
        footprints[venue.id] = footprint;
        found++;
      }
    }
    await page.run(`setSources(${JSON.stringify(sources())})`);
    await new Promise((resolve) => setTimeout(resolve, 400));

    const file = join(out, `${name}.png`);
    await page.screenshot(file);
    console.log(`${name}: ${file}  (buildings known for ${Object.keys(footprints).length}/${venues.length} venues, ${found} new)`);
    for (const problem of new Set(problems)) console.log(`  ! ${problem}`);
  }
  for (const line of page.logs.filter((l) => !l.includes('WebGL')).slice(0, 20)) console.log(`  log ${line}`);
} finally {
  await page.close();
  server.close();
}
