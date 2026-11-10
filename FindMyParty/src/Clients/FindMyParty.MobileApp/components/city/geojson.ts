// Turns venues into the GeoJSON the map draws. Pure functions: no React, no map imports.

import type { Feature, FeatureCollection, LineString, Point, Polygon, Position } from 'geojson';
import { crowdColor, crowdStrength } from '@/services/crowd';
import type { VenueSummary } from '@/types/api';
import { BEAM, type LngLat } from './constants';

/** What every venue feature carries; the layer styles and the tap handler read these by name. */
export type VenueProps = {
  id: string;
  name: string;
  /** The crowd in a few words, or '' when nothing is known. */
  label: string;
  /** Name, and under it the label when there is one. What the map prints. */
  text: string;
  /** 0–1, from `crowdStrength`. Sets the beam's height and the disc's size. */
  strength: number;
  /** From `crowdColor`: violet when quiet, rose when full. */
  color: string;
  /** Passes taken but nobody scanned in yet. */
  expected: boolean;
  selected: boolean;
};

/** Beam polygons also say which of the two they are: the beam or the faint wider one. */
export type BeamProps = VenueProps & { kind: 'core' | 'halo' };

// Metres to degrees.
// The Earth's mean radius is 6 371 008.8 m, so one degree of arc along a meridian is
// (π / 180) × 6 371 008.8 m ≈ 111 195 m. That is one degree of latitude, everywhere.
// A degree of longitude is that long only at the equator; circles of latitude shrink
// with cos(latitude), so at latitude φ one degree of longitude is 111 195 m × cos φ.
// Hence: Δlat° = metres / 111 195, and Δlng° = metres / (111 195 × cos φ).
// Check at Podgorica (φ = 42.44°, cos φ = 0.738): 7 m is 0.0000630° of latitude and
// 0.0000853° of longitude. Over a few metres the flat-Earth error is far below a centimetre.
const EARTH_RADIUS_M = 6_371_008.8;
const METRES_PER_DEGREE = (Math.PI / 180) * EARTH_RADIUS_M;
const TO_RADIANS = Math.PI / 180;

/**
 * A closed ring of `points` corners approximating a circle of `radiusM` metres around a coordinate.
 * Counter-clockwise, first corner repeated at the end, as GeoJSON wants an outer ring.
 */
export function circleRing(center: LngLat, radiusM: number, points: number = BEAM.points): Position[] {
  const [lng, lat] = center;
  // Never divide by zero at a pole; no venue is there, but a bad coordinate should not make NaNs.
  const cosLat = Math.max(Math.cos(lat * TO_RADIANS), 1e-6);
  const dLat = radiusM / METRES_PER_DEGREE;
  const dLng = radiusM / (METRES_PER_DEGREE * cosLat);

  const ring: Position[] = [];
  for (let i = 0; i < points; i++) {
    const angle = (2 * Math.PI * i) / points;
    // East is +longitude, north is +latitude, so a growing angle walks counter-clockwise.
    ring.push([lng + dLng * Math.cos(angle), lat + dLat * Math.sin(angle)]);
  }
  ring.push(ring[0]);
  return ring;
}

/**
 * The crowd line under a venue's name on the map, kept short: "200+" for a live count,
 * "50+ expected" for passes taken, '' when nothing is known. Never an exact number.
 */
export function mapCrowdLabel(level: string | null | undefined, source: string | null | undefined): string {
  if (!level) return '';
  const live = source === 'live';
  if (level === 'quiet') return live ? 'Quiet' : 'Quiet so far';
  return live ? level : `${level} expected`;
}

function isOnEarth(venue: VenueSummary): boolean {
  return (
    Number.isFinite(venue.latitude) &&
    Number.isFinite(venue.longitude) &&
    Math.abs(venue.latitude) <= 90 &&
    Math.abs(venue.longitude) <= 180
  );
}

function venueProps(venue: VenueSummary, selectedId: string | null): VenueProps {
  const label = mapCrowdLabel(venue.crowdLevel, venue.crowdSource);
  return {
    id: venue.id,
    name: venue.name,
    label,
    text: label ? `${venue.name}\n${label}` : venue.name,
    strength: crowdStrength(venue.crowdLevel),
    color: crowdColor(venue.crowdLevel),
    expected: venue.crowdSource === 'expected',
    selected: venue.id === selectedId,
  };
}

/** One point per venue: the discs at the beams' feet and the labels hang on these. */
export function venuePoints(
  venues: readonly VenueSummary[],
  selectedId: string | null,
): FeatureCollection<Point, VenueProps> {
  const features: Feature<Point, VenueProps>[] = [];
  for (const venue of venues) {
    if (!isOnEarth(venue)) continue;
    features.push({
      type: 'Feature',
      properties: venueProps(venue, selectedId),
      geometry: { type: 'Point', coordinates: [venue.longitude, venue.latitude] },
    });
  }
  return { type: 'FeatureCollection', features };
}

/** Two small circles per venue for the map to extrude: the beam, and a wider faint one around it. */
export function venueBeams(
  venues: readonly VenueSummary[],
  selectedId: string | null,
): FeatureCollection<Polygon, BeamProps> {
  const features: Feature<Polygon, BeamProps>[] = [];
  for (const venue of venues) {
    if (!isOnEarth(venue)) continue;
    const props = venueProps(venue, selectedId);
    const center: LngLat = [venue.longitude, venue.latitude];
    features.push(
      {
        type: 'Feature',
        properties: { ...props, kind: 'core' },
        geometry: { type: 'Polygon', coordinates: [circleRing(center, BEAM.coreRadiusM)] },
      },
      {
        type: 'Feature',
        properties: { ...props, kind: 'halo' },
        geometry: { type: 'Polygon', coordinates: [circleRing(center, BEAM.haloRadiusM)] },
      },
    );
  }
  return { type: 'FeatureCollection', features };
}

/** The walking route as the map wants it; an empty collection draws nothing. */
export function routeCollection(line: LineString | null): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: line ? [{ type: 'Feature', properties: {}, geometry: line }] : [],
  };
}

/** Metres between two coordinates. Flat-Earth maths, which is exact enough within a city. */
export function metresBetween(a: LngLat, b: LngLat): number {
  const cosLat = Math.cos(((a[1] + b[1]) / 2) * TO_RADIANS);
  const east = (b[0] - a[0]) * METRES_PER_DEGREE * cosLat;
  const north = (b[1] - a[1]) * METRES_PER_DEGREE;
  return Math.hypot(east, north);
}

/** The venue closest to a coordinate, if one is within `withinM` metres. */
export function nearestVenueId(venues: readonly VenueSummary[], at: LngLat, withinM: number): string | null {
  let best: string | null = null;
  let bestDistance = withinM;
  for (const venue of venues) {
    if (!isOnEarth(venue)) continue;
    const distance = metresBetween(at, [venue.longitude, venue.latitude]);
    if (distance <= bestDistance) {
      best = venue.id;
      bestDistance = distance;
    }
  }
  return best;
}

/** The id of the venue a tap landed on, from the features the map reports under the finger. */
export function tappedVenueId(features: readonly Feature[]): string | null {
  for (const feature of features) {
    const id: unknown = feature.properties?.id;
    if (typeof id === 'string' && id.length > 0) return id;
  }
  return null;
}
