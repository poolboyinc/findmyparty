// Geometry for lighting up a venue's own building: the bright frame along its roof edge and the
// thin posts at its corners. Pure: no React, no map, no `@/` imports (unit-tested in plain Node:
// services/__tests__/outline.test.mjs).

type Position = number[];
type LngLat = [number, number];
/** A point in metres east and north of some origin. */
export type XY = [number, number];

const METRES_PER_DEGREE = (Math.PI / 180) * 6_371_008.8;

/** A ring of coordinates as metres around `origin`. Over one building the flat-Earth error is nil. */
export function toMetres(ring: readonly Position[], origin: LngLat): XY[] {
  const cosLat = Math.max(Math.cos((origin[1] * Math.PI) / 180), 1e-6);
  return ring.map(([lng, lat]) => [
    (lng - origin[0]) * METRES_PER_DEGREE * cosLat,
    (lat - origin[1]) * METRES_PER_DEGREE,
  ]);
}

/** The inverse of `toMetres`. */
export function toDegrees(points: readonly XY[], origin: LngLat): Position[] {
  const cosLat = Math.max(Math.cos((origin[1] * Math.PI) / 180), 1e-6);
  return points.map(([x, y]) => [origin[0] + x / (METRES_PER_DEGREE * cosLat), origin[1] + y / METRES_PER_DEGREE]);
}

/** Twice the signed area: positive when the corners run counter-clockwise. */
function signedArea2(points: readonly XY[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum;
}

/**
 * The ring without its repeated closing corner, without corners closer than `minEdgeM` to the one
 * before, and without corners that lie on a straight wall. Map tiles cut walls into short pieces;
 * this gives back the building's real corners.
 */
export function tidy(points: readonly XY[], minEdgeM = 0.25, straightDeg = 4): XY[] {
  let ring = points.slice();
  if (ring.length > 1) {
    const [fx, fy] = ring[0];
    const [lx, ly] = ring[ring.length - 1];
    if (Math.hypot(fx - lx, fy - ly) < 1e-6) ring = ring.slice(0, -1);
  }
  const spaced: XY[] = [];
  for (const p of ring) {
    const last = spaced[spaced.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= minEdgeM) spaced.push(p);
  }
  while (spaced.length > 3 && Math.hypot(spaced[0][0] - spaced[spaced.length - 1][0], spaced[0][1] - spaced[spaced.length - 1][1]) < minEdgeM) {
    spaced.pop();
  }
  if (spaced.length < 4) return spaced;
  const corners = spaced.filter((_, i) => turnDeg(spaced, i) >= straightDeg);
  return corners.length >= 3 ? corners : spaced;
}

/** How sharply the outline turns at corner `i`, in degrees: 0 on a straight wall, 90 at a square corner. */
export function turnDeg(points: readonly XY[], i: number): number {
  const n = points.length;
  const [px, py] = points[(i + n - 1) % n];
  const [x, y] = points[i];
  const [nx, ny] = points[(i + 1) % n];
  const a = Math.atan2(y - py, x - px);
  const b = Math.atan2(ny - y, nx - x);
  let turn = Math.abs(b - a);
  if (turn > Math.PI) turn = 2 * Math.PI - turn;
  return (turn * 180) / Math.PI;
}

/**
 * The outline moved `d` metres towards the inside of the building (a negative `d` moves it out).
 * Each corner slides along the bisector of its two walls, so walls stay parallel to themselves;
 * a very sharp corner is not allowed to shoot further than `3 × d`.
 */
export function inset(points: readonly XY[], d: number): XY[] {
  const n = points.length;
  if (n < 3) return points.slice();
  // With the corners running counter-clockwise the inside is on the left of each wall.
  const side = signedArea2(points) >= 0 ? 1 : -1;
  const out: XY[] = [];
  for (let i = 0; i < n; i++) {
    const [px, py] = points[(i + n - 1) % n];
    const [x, y] = points[i];
    const [nx, ny] = points[(i + 1) % n];
    const l1 = Math.hypot(x - px, y - py) || 1;
    const l2 = Math.hypot(nx - x, ny - y) || 1;
    // Unit normals of the wall before and the wall after, pointing inside.
    const n1: XY = [(-(y - py) / l1) * side, ((x - px) / l1) * side];
    const n2: XY = [(-(ny - y) / l2) * side, ((nx - x) / l2) * side];
    const dot = n1[0] * n2[0] + n1[1] * n2[1];
    let mx = n1[0] + n2[0];
    let my = n1[1] + n2[1];
    const k = 1 + dot;
    if (k < 1e-3) {
      // The outline doubles back on itself: no bisector, slide along the first wall's normal.
      mx = n1[0];
      my = n1[1];
    } else {
      mx /= k;
      my /= k;
    }
    const reach = Math.hypot(mx, my);
    const limit = 3;
    if (reach > limit) {
      mx = (mx / reach) * limit;
      my = (my / reach) * limit;
    }
    out.push([x + mx * d, y + my * d]);
  }
  return out;
}

/** The shorter side of the box around the outline, in metres: how much room there is to draw in. */
export function narrowSide(points: readonly XY[]): number {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return Math.min(maxX - minX, maxY - minY);
}

/** The building's real corners (a turn of at least `minTurn` degrees), sharpest first, at most `max`. */
export function sharpCorners(points: readonly XY[], minTurn = 30, max = 8): XY[] {
  return points
    .map((p, i) => ({ p, turn: turnDeg(points, i) }))
    .filter((c) => c.turn >= minTurn)
    .sort((a, b) => b.turn - a.turn)
    .slice(0, max)
    .map((c) => c.p);
}

/** A closed square of side `sideM` around a point, counter-clockwise. */
export function squareAround([x, y]: XY, sideM: number): XY[] {
  const h = sideM / 2;
  return [
    [x - h, y - h],
    [x + h, y - h],
    [x + h, y + h],
    [x - h, y + h],
  ];
}

/** A ring closed the way GeoJSON wants it: first corner repeated at the end. */
export function closed<T>(points: readonly T[]): T[] {
  return points.length ? [...points, points[0]] : [];
}

/** `points` in the opposite direction (a hole runs against its outer ring). */
export function reversed<T>(points: readonly T[]): T[] {
  return points.slice().reverse();
}
