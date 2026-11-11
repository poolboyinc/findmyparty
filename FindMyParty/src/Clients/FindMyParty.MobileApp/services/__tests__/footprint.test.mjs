// The building a venue is in, picked from the map's building features (components/city/footprint.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { footprintFromServer, pickFootprint, inflate, venueOfBuilding } from '../../components/city/footprint.ts';

// A square building ~20 m across around [19.26, 42.44], and another ~60 m east.
const square = (lng, lat, d = 0.0001) => [[lng - d, lat - d], [lng + d, lat - d], [lng + d, lat + d], [lng - d, lat + d], [lng - d, lat - d]];
const building = (ring, props = {}) => ({ type: 'Feature', properties: { height: 18, min_height: 0, ...props }, geometry: { type: 'Polygon', coordinates: [ring] } });

test('the building the venue stands in is chosen, with its height', () => {
  const inside = building(square(19.26, 42.44), { height: 24 });
  const nearby = building(square(19.2607, 42.44));

  const found = pickFootprint([19.26002, 42.44001], [nearby, inside]);

  assert.equal(found.height, 24);
  assert.deepEqual(found.centroid.map((v) => +v.toFixed(5)), [19.26, 42.44]);
});

test('a venue on the street gets the closest building within reach', () => {
  const near = building(square(19.2603, 42.44)); // ~25 m east
  const far = building(square(19.262, 42.44)); // ~165 m east

  const found = pickFootprint([19.26, 42.44], [far, near]);

  assert.ok(Math.abs(found.centroid[0] - 19.2603) < 1e-6);
});

test('nothing close enough means no building', () => {
  const far = building(square(19.262, 42.44));

  assert.equal(pickFootprint([19.26, 42.44], [far]), null);
});

test('multipolygons and features without heights are handled', () => {
  const multi = { type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: [[square(19.26, 42.44)], [square(19.3, 42.5)]] } };

  const found = pickFootprint([19.26, 42.44], [multi]);

  assert.equal(found.height, 10);
  assert.equal(found.minHeight, 0);
});

test('inflating a footprint pushes every corner outwards from its middle', () => {
  const ring = square(19.26, 42.44);
  const bigger = inflate(ring, [19.26, 42.44], 1.1);

  assert.ok(bigger[1][0] > ring[1][0] && bigger[1][1] < ring[1][1]);
  assert.deepEqual(bigger[0], bigger[bigger.length - 1]);
});

test('a small part on the roof does not win over the building around it', () => {
  const whole = building(square(19.26, 42.44, 0.0003), { height: 20 });
  const lift = building(square(19.26, 42.44, 0.00004), { height: 24 });

  const found = pickFootprint([19.26001, 42.44001], [lift, whole]);

  assert.equal(found.height, 20);
  assert.ok(Math.abs(found.ring[0][0] - (19.26 - 0.0003)) < 1e-9);
});

test('a building cut in two by a map tile edge is put back together', () => {
  // Two halves that overlap a little, as tiles hand them over, with the same id.
  const west = { ...building([[19.2598, 42.4399], [19.26002, 42.4399], [19.26002, 42.4401], [19.2598, 42.4401], [19.2598, 42.4399]]), id: 7 };
  const east = { ...building([[19.25998, 42.4399], [19.2602, 42.4399], [19.2602, 42.4401], [19.25998, 42.4401], [19.25998, 42.4399]]), id: 7 };

  const found = pickFootprint([19.2599, 42.44], [west, east]);

  const lngs = found.ring.map((p) => p[0]);
  assert.ok(Math.abs(Math.min(...lngs) - 19.2598) < 1e-9);
  assert.ok(Math.abs(Math.max(...lngs) - 19.2602) < 1e-9);
  assert.ok(Math.abs(found.centroid[0] - 19.26) < 1e-6);
});

test('a tap on a venue\'s building finds the venue; a tap on another building finds nothing', () => {
  const club = building(square(19.26, 42.44));
  const other = building(square(19.262, 42.44));
  const footprints = { monkey: pickFootprint([19.26, 42.44], [club]) };

  assert.equal(venueOfBuilding([club], footprints), 'monkey');
  assert.equal(venueOfBuilding([other], footprints), null);
  assert.equal(venueOfBuilding([], footprints), null);
});

test('an outline held by the server becomes the venue\'s building; a broken one is ignored', () => {
  const found = footprintFromServer({ ring: square(19.26, 42.44), heightM: 18 });
  assert.equal(found.height, 18);
  assert.deepEqual(found.centroid.map((v) => +v.toFixed(5)), [19.26, 42.44]);

  assert.equal(footprintFromServer(null), null);
  assert.equal(footprintFromServer({ ring: [[19.26, 42.44]], heightM: 10 }), null);
  assert.equal(footprintFromServer({ ring: 'nonsense' }), null);
});
