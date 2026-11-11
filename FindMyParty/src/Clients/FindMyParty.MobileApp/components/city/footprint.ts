// Which building a venue is in, from the building features the map has drawn. Pure: no React, no map,
// no `@/` imports (unit-tested in plain Node: services/__tests__/footprint.test.mjs).

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

/** The average of a ring's corners (the closing corner counted once). Close enough for a building. */
function centroidOf(ring: Position[]): LngLat {
  const corners = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring;
  const sum = corners.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]);
  return [sum[0] / corners.length, sum[1] / corners.length];
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

/**
 * The building the venue stands in; if its point is on the street, the closest building within
 * 45 m. Null when there is none (not drawn yet, or no building near).
 */
export function pickFootprint(at: LngLat, features: readonly BuildingFeature[]): Footprint | null {
  let best: { footprint: Footprint; distance: number } | null = null;
  for (const feature of features) {
    for (const ring of outerRings(feature)) {
      if (ring.length < 4) continue;
      const centroid = centroidOf(ring);
      const distance = contains(ring, at) ? 0 : metres(at, centroid);
      if (distance > REACH_M) continue;
      if (!best || distance < best.distance) {
        best = {
          distance,
          footprint: {
            ring,
            centroid,
            height: numberOr(feature.properties?.height, DEFAULT_HEIGHT_M),
            minHeight: numberOr(feature.properties?.min_height, 0),
          },
        };
      }
    }
  }
  return best?.footprint ?? null;
}

/** The ring scaled about `center` by `factor`, so a layer drawn on it covers the building's own edges. */
export function inflate(ring: Position[], center: LngLat, factor: number): Position[] {
  return ring.map(([lng, lat]) => [center[0] + (lng - center[0]) * factor, center[1] + (lat - center[1]) * factor]);
}
