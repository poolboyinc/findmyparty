// Which building a venue is in, from the building features the map has drawn. Pure: no React, no map,
// no `@/` imports (unit-tested in plain Node: services/__tests__/footprint.test.mjs).

import polygonClipping from 'polygon-clipping';

type Position = number[];
type LngLat = [number, number];

/** The venue's building: its outline, middle and height in metres (as Mapbox Streets gives them). */
export type Footprint = {
  ring: Position[];
  centroid: LngLat;
  height: number;
  minHeight: number;
};

type BuildingFeature = {
  id?: string | number | null;
  properties?: Record<string, unknown> | null;
  geometry?: { type: string; coordinates?: unknown } | null;
};

/** How far from the venue's point a building may be and still count as its building. */
const REACH_M = 45;
/** Height used when the data has none. */
const DEFAULT_HEIGHT_M = 10;

const METRES_PER_DEGREE = (Math.PI / 180) * 6_371_008.8;

function metres(a: Position, b: Position): number {
  const cosLat = Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
  const dx = (b[0] - a[0]) * METRES_PER_DEGREE * cosLat;
  const dy = (b[1] - a[1]) * METRES_PER_DEGREE;
  return Math.hypot(dx, dy);
}

/** Outer rings of a Polygon or MultiPolygon feature. */
function outerRings(feature: BuildingFeature): Position[][] {
  const g = feature.geometry;
  if (!g) return [];
  if (g.type === 'Polygon') return [(g.coordinates as Position[][])[0]].filter(Boolean);
  if (g.type === 'MultiPolygon') return (g.coordinates as Position[][][]).map((polygon) => polygon[0]).filter(Boolean);
  return [];
}

/**
 * Twice the ring's signed area, in square degrees: only ever compared with other rings nearby.
 * Measured from the ring's first corner: coordinates are large numbers that differ in their last
 * digits, and multiplying them as they are would lose exactly those digits.
 */
function area2(ring: Position[]): number {
  const [ox, oy] = ring[0];
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j][0] - ox) * (ring[i][1] - oy) - (ring[i][0] - ox) * (ring[j][1] - oy);
  }
  return sum;
}

/** The middle of the ring's area (not of its corners, which crowd where a wall is curved). */
function centroidOf(ring: Position[]): LngLat {
  const [ox, oy] = ring[0];
  const a2 = area2(ring);
  if (Math.abs(a2) < 1e-18) {
    const sum = ring.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]);
    return [sum[0] / ring.length, sum[1] / ring.length];
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const x0 = ring[j][0] - ox;
    const y0 = ring[j][1] - oy;
    const x1 = ring[i][0] - ox;
    const y1 = ring[i][1] - oy;
    const cross = x0 * y1 - x1 * y0;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  return [ox + cx / (3 * a2), oy + cy / (3 * a2)];
}

/** Ray casting: is the point inside the ring? */
function contains(ring: Position[], p: Position): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

type Building = { rings: Position[][]; height: number; minHeight: number };

/**
 * The map hands a building over in pieces when it lies across the edge of a map tile: the pieces
 * carry the same id. This puts them back together, one entry per building.
 */
function gather(features: readonly BuildingFeature[]): Building[] {
  const byId = new Map<string | number, Building>();
  const loose: Building[] = [];
  for (const feature of features) {
    const rings = outerRings(feature).filter((ring) => ring.length >= 4);
    if (rings.length === 0) continue;
    const piece: Building = {
      rings,
      height: numberOr(feature.properties?.height, DEFAULT_HEIGHT_M),
      minHeight: numberOr(feature.properties?.min_height, 0),
    };
    const id = feature.id;
    if (id === undefined || id === null) {
      loose.push(piece);
      continue;
    }
    const known = byId.get(id);
    if (!known) byId.set(id, piece);
    else {
      known.rings.push(...rings);
      known.height = Math.max(known.height, piece.height);
      known.minHeight = Math.min(known.minHeight, piece.minHeight);
    }
  }
  return [...byId.values(), ...loose].map((building) => ({ ...building, rings: merged(building.rings) }));
}

/** Overlapping or touching pieces as one outline each. Left as they are if they cannot be joined. */
function merged(rings: Position[][]): Position[][] {
  if (rings.length < 2) return rings;
  try {
    const [first, ...rest] = rings.map((ring) => [ring.map(([x, y]) => [x, y] as [number, number])]);
    return polygonClipping.union(first, ...rest).map((polygon) => polygon[0] as Position[]);
  } catch {
    return rings;
  }
}

/** Every building among the features, each put back together, as outline, middle and height. */
export function allFootprints(features: readonly BuildingFeature[]): Footprint[] {
  return gather(features).flatMap((building) =>
    building.rings
      .filter((ring) => ring.length >= 4)
      .map((ring) => ({ ring, centroid: centroidOf(ring), height: building.height, minHeight: building.minHeight })),
  );
}

/**
 * The building the venue stands in (the largest outline around its point: a building may carry
 * smaller parts on its roof); if its point is on the street, the closest building within 45 m.
 * Null when there is none (not drawn yet, or no building near).
 */
export function pickFootprint(at: LngLat, features: readonly BuildingFeature[]): Footprint | null {
  let around: { footprint: Footprint; area: number } | null = null;
  let near: { footprint: Footprint; distance: number } | null = null;
  for (const building of gather(features)) {
    for (const ring of building.rings) {
      if (ring.length < 4) continue;
      const centroid = centroidOf(ring);
      const footprint: Footprint = { ring, centroid, height: building.height, minHeight: building.minHeight };
      if (contains(ring, at)) {
        const area = Math.abs(area2(ring));
        if (!around || area > around.area) around = { footprint, area };
        continue;
      }
      const distance = metres(at, centroid);
      if (distance <= REACH_M && (!near || distance < near.distance)) near = { footprint, distance };
    }
  }
  return around?.footprint ?? near?.footprint ?? null;
}

/**
 * Which of the known venue buildings a tap landed on: the venue whose building's middle lies
 * inside one of the building outlines under the finger. Null when the tap was on some other building.
 */
export function venueOfBuilding(
  tapped: readonly BuildingFeature[],
  footprints: Readonly<Record<string, Footprint>>,
): string | null {
  const outlines = allFootprints(tapped);
  if (outlines.length === 0) return null;
  for (const [venueId, footprint] of Object.entries(footprints)) {
    if (outlines.some((outline) => contains(outline.ring, footprint.centroid))) return venueId;
  }
  return null;
}

/** The ring scaled about `center` by `factor`, so a layer drawn on it covers the building's own edges. */
export function inflate(ring: Position[], center: LngLat, factor: number): Position[] {
  return ring.map(([lng, lat]) => [center[0] + (lng - center[0]) * factor, center[1] + (lat - center[1]) * factor]);
}
