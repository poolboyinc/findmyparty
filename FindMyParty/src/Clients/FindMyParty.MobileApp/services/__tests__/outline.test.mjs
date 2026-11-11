import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inset, narrowSide, sharpCorners, tidy, toDegrees, toMetres, turnDeg } from '../../components/city/outline.ts';

const SQUARE = [
  [0, 0],
  [20, 0],
  [20, 10],
  [0, 10],
];

test('metres and degrees round-trip', () => {
  const origin = [19.26, 42.44];
  const ring = [
    [19.26, 42.44],
    [19.2603, 42.4402],
  ];
  const back = toDegrees(toMetres(ring, origin), origin);
  assert.ok(Math.abs(back[1][0] - ring[1][0]) < 1e-9);
  assert.ok(Math.abs(back[1][1] - ring[1][1]) < 1e-9);
  // 0.0002° of latitude is about 22 m.
  assert.ok(Math.abs(toMetres(ring, origin)[1][1] - 22.24) < 0.05);
});

test('tidy drops the closing corner, doubled corners and corners on a straight wall', () => {
  const messy = [[0, 0], [10, 0], [10.1, 0], [20, 0], [20, 10], [0, 10], [0, 0]];
  assert.deepEqual(tidy(messy), SQUARE);
});

test('inset moves every wall of a square inwards by the same distance', () => {
  assert.deepEqual(inset(SQUARE, 2), [
    [2, 2],
    [18, 2],
    [18, 8],
    [2, 8],
  ]);
});

test('inset works the same whichever way the corners run', () => {
  const clockwise = SQUARE.slice().reverse();
  assert.deepEqual(inset(clockwise, 2), [
    [2, 8],
    [18, 8],
    [18, 2],
    [2, 2],
  ]);
});

test('a negative inset grows the outline', () => {
  assert.deepEqual(inset(SQUARE, -1)[0], [-1, -1]);
});

test('inset keeps the inner corner of an L-shaped building inside it', () => {
  const L = [[0, 0], [20, 0], [20, 10], [10, 10], [10, 20], [0, 20]];
  const inner = inset(L, 1);
  // The reflex corner at (10, 10) slides to (9, 9): still parallel walls one metre in.
  assert.deepEqual(inner[3].map((v) => Math.round(v * 1000) / 1000), [9, 9]);
});

test('a needle-sharp corner does not shoot far away', () => {
  const needle = [[0, 0], [40, 1], [0, 2]];
  const tip = inset(needle, 1)[1];
  assert.ok(Math.hypot(tip[0] - 40, tip[1] - 1) <= 3.0001);
});

test('turnDeg and sharpCorners find real corners', () => {
  assert.equal(Math.round(turnDeg(SQUARE, 1)), 90);
  const withBend = [[0, 0], [10, 0.4], [20, 0], [20, 10], [0, 10]];
  assert.equal(sharpCorners(withBend).length, 4);
  assert.equal(sharpCorners(SQUARE, 30, 2).length, 2);
});

test('narrowSide is the short side of the box around the outline', () => {
  assert.equal(narrowSide(SQUARE), 10);
});
