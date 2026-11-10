// Turns venues into the GeoJSON the map draws. Pure functions: no React, no map imports.

import type { Feature, FeatureCollection, LineString, Point, Polygon, Position } from 'geojson';
import { crowdColor, crowdStrength } from '@/services/crowd';
import { colors } from '@/theme';
import type { VenueSummary } from '@/types/api';
import { BEAM, LABEL, PALETTE, SWITCH, type LngLat, VENUE_BLOCK } from './constants';

/**
 * What the map shows. `live`: every venue by its crowd. `mine` (My City): the venues the user has
 * been scanned into, lit in lime; the others as dim ghosts.
 */
export type CityMode = 'live' | 'mine';

/** What every venue feature carries; the layer styles and the tap handler read these by name. */
export type VenueProps = {
  id: string;
  name: string;
  /** Which picture the feature was built for; My City names every venue. */
  mode: CityMode;
  /** The crowd under the name ("200+", "50+ expected"), or '' when there is none to show. */
  label: string;
  /** The selected venue's block: name, and under it the crowd ("200+ inside"). */
  text: string;
  /** 0–1, from `crowdStrength`. Sets the disc's size in flat mode. */
  strength: number;
  /** The venue's light: violet when quiet, rose when full; lime in My City. */
  color: string;
  /** Text colour of the name: white, or dim for a ghost. */
  nameColor: string;
  nameSize: number;
  /** Where the name and the crowd line sit above their point, in ems ([x, y]). */
  nameOffset: [number, number];
  countOffset: [number, number];
  /** Metres above the ground where the name floats: the top of the beam. */
  lift: number;
  /** Passes taken but nobody scanned in yet. */
  expected: boolean;
  /** My City: a venue the user has not been scanned into yet. */
  ghost: boolean;
  selected: boolean;
};

/** Which part of a beam a polygon is. */
export type BeamKind = 'block' | 'edge' | 'core' | 'piece' | 'halo' | 'ring' | 'ghost';

/** Beam polygons say which part they are, how high they start and end, and their own colour. */
export type BeamProps = VenueProps & {
  kind: BeamKind;
  /** For `piece`: 0 at the foot, up to the last piece at the top. */
  piece: number;
  base: number;
  top: number;
  fill: string;
};

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

/** A closed square of side 2 × `halfM` metres, counter-clockwise. */
export function squareRing(center: LngLat, halfM: number): Position[] {
  const [lng, lat] = center;
  const cosLat = Math.max(Math.cos(lat * TO_RADIANS), 1e-6);
  const dLat = halfM / METRES_PER_DEGREE;
  const dLng = halfM / (METRES_PER_DEGREE * cosLat);
  return [
    [lng - dLng, lat - dLat],
    [lng + dLng, lat - dLat],
    [lng + dLng, lat + dLat],
    [lng - dLng, lat + dLat],
    [lng - dLng, lat - dLat],
  ];
}

/** A square frame: outer square counter-clockwise, inner square clockwise. */
export function squareFrame(center: LngLat, halfM: number, widthM: number): Position[][] {
  return [squareRing(center, halfM), squareRing(center, halfM - widthM).reverse()];
}

/** An annulus: the outer circle counter-clockwise and the hole clockwise, as GeoJSON wants. */
export function annulus(center: LngLat, outerM: number, innerM: number): Position[][] {
  return [circleRing(center, outerM), circleRing(center, innerM).reverse()];
}

/** `#RRGGBB` mixed `share` of the way towards `#RRGGBB` `to` (0 is `from`, 1 is `to`). */
export function mixHex(from: string, to: string, share: number): string {
  const a = parseInt(from.slice(1, 7), 16);
  const b = parseInt(to.slice(1, 7), 16);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return from;
  const t = Math.min(1, Math.max(0, share));
  let out = '#';
  for (const shift of [16, 8, 0]) {
    const x = (a >> shift) & 255;
    const y = (b >> shift) & 255;
    out += Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, '0');
  }
  return out;
}

const WHITE = '#ffffff';

/** Metres of beam for a crowd strength: a stub when nothing is known, tallest when busiest. */
export function beamHeight(strength: number): number {
  if (!(strength > 0)) return BEAM.heightAtNothing;
  if (strength <= 0.2) {
    return BEAM.heightAtNothing + ((BEAM.heightAtQuiet - BEAM.heightAtNothing) * strength) / 0.2;
  }
  const t = Math.min(1, (strength - 0.2) / 0.8);
  return BEAM.heightAtQuiet + (BEAM.heightAtBusiest - BEAM.heightAtQuiet) * t;
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

/** The second line of the selected venue's block: "200+ inside", "50+ expected", "Quiet". */
export function selectedCrowdLine(level: string | null | undefined, source: string | null | undefined): string {
  if (!level) return '';
  if (level === 'quiet' || source !== 'live') return mapCrowdLabel(level, source);
  return `${level} inside`;
}

function isOnEarth(venue: VenueSummary): boolean {
  return (
    Number.isFinite(venue.latitude) &&
    Number.isFinite(venue.longitude) &&
    Math.abs(venue.latitude) <= 90 &&
    Math.abs(venue.longitude) <= 180
  );
}

/** What the map needs to know besides the venues. */
export type VenueDrawing = {
  selectedId: string | null;
  mode: CityMode;
  /** My City: the venues the user has been scanned into. */
  earned: ReadonlySet<string>;
  /** 2D: names sit above the discs instead of at the tops of the beams. */
  flat: boolean;
};

/** Name and crowd-line offsets, in ems of their own text sizes. */
function labelOffsets(
  hasCount: boolean,
  flat: boolean,
  strength: number,
): { name: [number, number]; count: [number, number] } {
  // Points between the anchor and the bottom of the crowd line: just above the beam's top, or
  // clear of the disc in flat mode (the disc there is about 6 + 9 × strength points across).
  const gap = flat ? 9 + 9 * strength : 4;
  const countLine = hasCount ? LABEL.countSize * 1.2 + 1.5 : 0;
  if (!LABEL.atBeamTop && !flat) {
    // Beside the foot: name and crowd line to the right of the beam.
    return { name: [1.1, hasCount ? -0.5 : 0], count: [1.6, 0.7] };
  }
  return {
    name: [0, -(gap + countLine) / LABEL.size],
    count: [0, -gap / LABEL.countSize],
  };
}

function venueProps(venue: VenueSummary, drawing: VenueDrawing): VenueProps {
  const mine = drawing.mode === 'mine';
  const ghost = mine && !drawing.earned.has(venue.id);
  const strength = crowdStrength(venue.crowdLevel);
  const expected = venue.crowdSource === 'expected';
  // My City is about where you have been, so it shows no crowd.
  const label = mine ? '' : mapCrowdLabel(venue.crowdLevel, venue.crowdSource);
  const crowd = mine ? '' : selectedCrowdLine(venue.crowdLevel, venue.crowdSource);
  const color = mine ? colors.earned : mixHex(crowdColor(venue.crowdLevel), PALETTE.ground, expected ? BEAM.expectedDim : 0);
  const height = ghost ? BEAM.heightGhost : mine ? BEAM.heightEarned : beamHeight(strength);
  const lift = drawing.flat || !LABEL.atBeamTop ? 0 : SWITCH.ringAtTop ? height + 2 : height;
  const offsets = labelOffsets(label.length > 0, drawing.flat, strength);
  return {
    id: venue.id,
    name: venue.name,
    mode: drawing.mode,
    label,
    text: crowd ? `${venue.name}\n${crowd}` : venue.name,
    strength,
    color,
    nameColor: ghost ? 'rgba(236,232,255,0.45)' : colors.label,
    nameSize: ghost ? LABEL.ghostSize : LABEL.size,
    nameOffset: offsets.name,
    countOffset: offsets.count,
    lift,
    expected,
    ghost,
    selected: venue.id === drawing.selectedId,
  };
}

/** One point per venue: the discs at the beams' feet and the names hang on these. */
export function venuePoints(
  venues: readonly VenueSummary[],
  drawing: VenueDrawing,
): FeatureCollection<Point, VenueProps> {
  const features: Feature<Point, VenueProps>[] = [];
  for (const venue of venues) {
    if (!isOnEarth(venue)) continue;
    features.push({
      type: 'Feature',
      properties: venueProps(venue, drawing),
      geometry: { type: 'Point', coordinates: [venue.longitude, venue.latitude] },
    });
  }
  return { type: 'FeatureCollection', features };
}

function beamPart(
  props: VenueProps,
  geometry: Position[][],
  part: Pick<BeamProps, 'kind' | 'base' | 'top' | 'fill'> & { piece?: number },
): Feature<Polygon, BeamProps> {
  return {
    type: 'Feature',
    properties: { ...props, piece: part.piece ?? 0, kind: part.kind, base: part.base, top: part.top, fill: part.fill },
    geometry: { type: 'Polygon', coordinates: geometry },
  };
}

/**
 * The polygons the map extrudes into each venue's light:
 * a thin white core, the coloured beam in pieces that fade towards the top, a faint wider beam
 * around the lower part, and a bright ring. A My City ghost is one short dim column.
 */
export function venueBeams(
  venues: readonly VenueSummary[],
  drawing: VenueDrawing,
): FeatureCollection<Polygon, BeamProps> {
  const features: Feature<Polygon, BeamProps>[] = [];
  for (const venue of venues) {
    if (!isOnEarth(venue)) continue;
    const props = venueProps(venue, drawing);
    const center: LngLat = [venue.longitude, venue.latitude];
    const beam = [circleRing(center, BEAM.beamRadiusM)];

    if (props.ghost) {
      features.push(beamPart(props, beam, { kind: 'ghost', base: 0, top: BEAM.heightGhost, fill: PALETTE.label }));
      continue;
    }

    const height = drawing.mode === 'mine' ? BEAM.heightEarned : beamHeight(props.strength);
    // The venue's block, with a bright edge on its roof; its height is not scaled with zoom.
    // Beams are scaled with zoom (BEAM.scaleByZoom), so they start a little above the roof to clear it.
    const ROOF = VENUE_BLOCK.heightM * 1.2;
    features.push(
      beamPart(props, [squareRing(center, VENUE_BLOCK.halfM)], {
        kind: 'block',
        base: 0,
        top: VENUE_BLOCK.heightM,
        fill: VENUE_BLOCK.fill,
      }),
      beamPart(props, squareFrame(center, VENUE_BLOCK.halfM, VENUE_BLOCK.edgeM), {
        kind: 'edge',
        base: VENUE_BLOCK.heightM,
        top: VENUE_BLOCK.heightM + VENUE_BLOCK.edgeDepthM,
        fill: mixHex(props.color, WHITE, 0.35),
      }),
    );
    features.push(
      beamPart(props, [circleRing(center, BEAM.coreRadiusM)], {
        kind: 'core',
        base: ROOF,
        top: height * BEAM.coreShare,
        fill: mixHex(props.color, WHITE, 0.82),
      }),
    );
    let from = ROOF / height;
    BEAM.pieces.forEach((piece, index) => {
      features.push(
        beamPart(props, beam, {
          kind: 'piece',
          piece: index,
          base: from * height,
          top: piece.to * height,
          fill: index === 0 ? mixHex(props.color, WHITE, BEAM.footWhite) : props.color,
        }),
      );
      from = piece.to;
    });
    features.push(
      beamPart(props, annulus(center, BEAM.ringOuterM, BEAM.ringInnerM), {
        kind: 'ring',
        base: SWITCH.ringAtTop ? height - BEAM.ringDepthM : 0,
        top: SWITCH.ringAtTop ? height : BEAM.ringDepthM,
        fill: mixHex(props.color, WHITE, BEAM.ringWhite),
      }),
      beamPart(props, [circleRing(center, BEAM.haloRadiusM)], {
        kind: 'halo',
        base: ROOF,
        top: height * BEAM.haloShare,
        fill: props.color,
      }),
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
