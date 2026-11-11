import assert from 'node:assert/strict';
import { test } from 'node:test';
import { base64Url, move, signArtCode, signArtUrl, signFeatures, signsInView } from '../../components/city/signs.ts';

const spot = { latitude: 42.44, longitude: 19.26, bearingDeg: 180, baseHeightM: 6, widthM: 12, heightM: 8, buildingHeightM: 20 };
const volt = { id: 'a', format: 'facade', own: false, text: 'VOLT', colorTop: '#FFD23C', colorBottom: '#ff7a18', ink: '#1a0a00', spot };
const kula = { ...volt, id: 'b', own: true, text: 'KULA' };
const aura = { ...volt, id: 'c', format: 'hologram', text: 'AURA|SPRITZ' };

test('base64Url matches the standard encoding, URL-safe and unpadded, for any text', () => {
  for (const text of ['', 'a', 'ab', 'abc', 'VOLT', 'Neon Bašta|ŠĆ', 'v1\nffd23c\n12\n8\n🎉?>']) {
    const expected = Buffer.from(text, 'utf8').toString('base64url');
    assert.equal(base64Url(text), expected, JSON.stringify(text));
  }
});

test('the art address carries colours, size and text in its path, with no query', () => {
  const url = signArtUrl('https://api.example/', volt, 'panel');
  assert.match(url, /^https:\/\/api\.example\/api\/sign-art\/panel\/[A-Za-z0-9_-]+\.glb$/);
  const decoded = Buffer.from(signArtCode(volt), 'base64url').toString('utf8');
  assert.equal(decoded, 'v1\nffd23c\nff7a18\n1a0a00\n12\n8\nVOLT');
  assert.match(signArtUrl('https://api.example', aura, 'hologram'), /\/api\/sign-art\/hologram\/.+\.png$/);
});

test('move goes the right way: north is up, east is right', () => {
  const north = move([19.26, 42.44], 0, 111.195);
  assert.ok(Math.abs(north[1] - 42.441) < 1e-5 && Math.abs(north[0] - 19.26) < 1e-9);
  const east = move([19.26, 42.44], 90, 10);
  assert.ok(east[0] > 19.26 && Math.abs(east[1] - 42.44) < 1e-9);
});

test('a wall panel stands in front of its wall, turned to face the way the wall faces', () => {
  const { panels, slabs, marks } = signFeatures([volt], 1.5);
  const panel = panels.features[0];
  // The wall faces south: the panel is half a metre south of the wall, not turned.
  assert.ok(panel.geometry.coordinates[1] < spot.latitude);
  assert.deepEqual(panel.properties.rotation, [0, 0, 0]);
  // Real metres wide; height and lift stretched like the city's buildings.
  assert.deepEqual(panel.properties.scale, [12, 1, 12]);
  assert.deepEqual(panel.properties.translation, [0, 0, 9]);
  // The slab behind it spans the panel's width, between the wall and the panel.
  const lngs = slabs.features[0].geometry.coordinates[0].map((p) => p[0]);
  const widthM = (Math.max(...lngs) - Math.min(...lngs)) * 111195 * Math.cos((42.44 * Math.PI) / 180);
  assert.ok(Math.abs(widthM - 12) < 0.05);
  assert.deepEqual([slabs.features[0].properties.base, slabs.features[0].properties.top], [6, 14]);
  // A paid sign carries the "Ad" tag at its top edge.
  assert.deepEqual(marks.features.map((m) => [m.properties.kind, m.properties.z]), [['tag', 14]]);
});

test('a venue\'s own sign has no "Ad" tag; a hologram is one floating mark over the roof', () => {
  assert.equal(signFeatures([kula], 1.5).marks.features.length, 0);
  const { panels, marks } = signFeatures([aura], 1.5);
  assert.equal(panels.features.length, 0);
  assert.deepEqual(marks.features.map((m) => [m.properties.kind, m.properties.z]), [['hologram', 20]]);
});

test('a panel on a wall that faces east is turned a quarter of the way round', () => {
  const east = { ...volt, spot: { ...spot, bearingDeg: 90 } };
  assert.deepEqual(signFeatures([east], 1).panels.features[0].properties.rotation, [0, 0, -90]);
});

test('at most three signs in view, in the order the server sent them', () => {
  const far = { ...volt, id: 'far', spot: { ...spot, longitude: 19.5 } };
  const many = [volt, far, kula, aura, { ...volt, id: 'd' }];
  const bounds = { west: 19.25, south: 42.43, east: 19.27, north: 42.45 };
  assert.deepEqual(signsInView(many, bounds).map((s) => s.id), ['a', 'b', 'c']);
  assert.deepEqual(signsInView(many, null, 2).map((s) => s.id), ['a', 'far']);
});
