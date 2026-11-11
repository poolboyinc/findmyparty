// Turns venues into the GeoJSON the map draws. Pure functions: no React, no map imports.

import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson';
import { crowdBars, crowdColor, crowdStrength } from '@/services/crowd';
import { colors } from '@/theme';
import type { VenueSummary } from '@/types/api';
import { BUILDINGS, FRAME, LABEL, PALETTE, SPRITE, SWITCH, type LngLat } from './constants';
import type { Footprint } from './footprint';
import { closed, inset, narrowSide, reversed, sharpCorners, squareAround, tidy, toDegrees, toMetres, type XY } from './outline';
import { BEAM_EARNED, RING_EARNED, RING_GHOST, RING_SELECTED, beamImage, beamLengthPt, countImage, pingImage, ringImage } from './sprites';

/**
 * What the map shows. `live`: every venue by its crowd. `mine` (My City): the venues the user has
 * been scanned into, lit in lime; the others as dashed rings waiting.
 */
export type CityMode = 'live' | 'mine';

/** A text offset in ems: [right, down]. */
type Offset = [number, number];

/** What every venue feature carries; the layer styles and the tap handler read these by name. */
export type VenueProps = {
  id: string;
  name: string;
  /** Which picture the feature was built for; My City names every venue. */
  mode: CityMode;
  /** The crowd under the name ("200+", "50+ expected"), or '' when there is none to show. */
  label: string;
  /** The same line as a picture in the venue's colour, or '' for none. */
  count: string;
  /** The selected venue's block: name, and under it the crowd ("200+ inside"). */
  text: string;
  /** 0–1, from `crowdStrength`. Sets the disc's size in flat mode. */
  strength: number;
  /** The venue's light: violet when quiet, rose when full; lime in My City. */
  color: string;
  /** Text colour of the name: white, or dim for a ghost. */
  nameColor: string;
  nameSize: number;
  /** The picture of the beam ('' for none) and of the ring on the roof. */
  beam: string;
  ring: string;
  /** The ripple a busy, scanning venue sends out from its roof, or '' for none. */
  ping: string;
  /** Metres from the ground to where the light stands: the roof of the venue's building, or 0. */
  roofM: number;
  /**
   * Where the name and the selected block (in ems of their own text size) and the crowd line (in
   * points) sit above the roof, at the three zooms of SPRITE.sizeByZoom: the beam under them
   * changes size with zoom.
   */
  nameFar: Offset;
  nameMid: Offset;
  nameNear: Offset;
  countFar: Offset;
  countMid: Offset;
  countNear: Offset;
  blockFar: Offset;
  blockMid: Offset;
  blockNear: Offset;
  /** Passes taken but nobody scanned in yet. */
  expected: boolean;
  /** My City: a venue the user has not been scanned into yet. */
  ghost: boolean;
  selected: boolean;
};

/** Which part of a lit building a polygon is. */
export type ShapeKind = 'frame' | 'post';

/** The polygons say which part they are, which zoom band they are for, how high they stand, and their colour. */
export type ShapeProps = {
  id: string;
  kind: ShapeKind;
  /** Index into FRAME.widthM: the same shape is made once per zoom band. */
  band: number;
  base: number;
  top: number;
  fill: string;
  selected: boolean;
};

const EARTH_RADIUS_M = 6_371_008.8;
const METRES_PER_DEGREE = (Math.PI / 180) * EARTH_RADIUS_M;
const TO_RADIANS = Math.PI / 180;

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
  /** 2D: names sit above the discs instead of at the tips of the beams. */
  flat: boolean;
  /** The real building each venue is in, once it is known (useVenueFootprints). */
  footprints?: Readonly<Record<string, Footprint>>;
};

/** Where a venue's light stands: the middle of its building when known, else its own point. */
function anchorOf(venue: VenueSummary, drawing: VenueDrawing): LngLat {
  return drawing.footprints?.[venue.id]?.centroid ?? [venue.longitude, venue.latitude];
}

/** Metres from the ground to the top of the lit roof line (before the map's vertical stretch). */
function roofTop(footprint: Footprint | undefined): number {
  return footprint ? footprint.height + BUILDINGS.roofCapM + FRAME.depthM : 0;
}

/**
 * Name, crowd-line and selected-block offsets for a beam `beamPt` points long at size 1,
 * when the beam is drawn at `size`. All three hang from their bottom edge.
 */
function offsetsAt(beamPt: number, size: number, hasCount: boolean, flatGap: number | null): { name: Offset; count: Offset; block: Offset } {
  // Points between the anchor and the bottom of the lowest line.
  const lift = flatGap ?? beamPt * size + LABEL.gap;
  const countLine = hasCount ? LABEL.countHeight : 0;
  return {
    name: [0, -(lift + countLine) / LABEL.size],
    count: [0, -lift],
    block: [0, -(lift + 6) / LABEL.selectedSize],
  };
}

function venueProps(venue: VenueSummary, drawing: VenueDrawing): VenueProps {
  const mine = drawing.mode === 'mine';
  const ghost = mine && !drawing.earned.has(venue.id);
  const bars = crowdBars(venue.crowdLevel);
  const strength = crowdStrength(venue.crowdLevel);
  const expected = venue.crowdSource === 'expected';
  const selected = venue.id === drawing.selectedId;
  // My City is about where you have been, so it shows no crowd.
  const label = mine ? '' : mapCrowdLabel(venue.crowdLevel, venue.crowdSource);
  const crowd = mine ? '' : selectedCrowdLine(venue.crowdLevel, venue.crowdSource);
  const color = mine ? colors.earned : crowdColor(venue.crowdLevel);

  const beam = ghost ? '' : mine ? BEAM_EARNED : beamImage(bars, expected);
  const ring = ghost ? RING_GHOST : selected ? RING_SELECTED : mine ? RING_EARNED : ringImage(bars);
  const beamPt = ghost ? 4 : beamLengthPt(mine ? SPRITE.earnedHeat : strength);

  // In flat mode the name clears the disc (about 6 + 9 × strength points across); tilted, the beam.
  const flatGap = drawing.flat ? 9 + 9 * strength : null;
  const hasCount = label.length > 0;
  const [, far, , mid, , near] = SPRITE.sizeByZoom;
  const sizes = SWITCH.beamsScaleWithZoom ? [far, mid, near] : [1, 1, 1];
  const [atFar, atMid, atNear] = sizes.map((size) => offsetsAt(beamPt, size, hasCount, flatGap));

  return {
    id: venue.id,
    name: venue.name,
    mode: drawing.mode,
    label,
    count: hasCount ? countImage(bars, expected) : '',
    text: crowd ? `${venue.name}\n${crowd}` : venue.name,
    strength,
    color,
    nameColor: ghost ? 'rgba(236,232,255,0.45)' : colors.label,
    nameSize: ghost ? LABEL.ghostSize : LABEL.size,
    beam,
    ring,
    ping: !mine && !expected && !selected ? pingImage(bars) : '',
    roofM: drawing.flat ? 0 : roofTop(drawing.footprints?.[venue.id]),
    nameFar: atFar.name,
    nameMid: atMid.name,
    nameNear: atNear.name,
    countFar: atFar.count,
    countMid: atMid.count,
    countNear: atNear.count,
    blockFar: atFar.block,
    blockMid: atMid.block,
    blockNear: atNear.block,
    expected,
    ghost,
    selected,
  };
}

/** One point per venue: the lights on the roof, the names and the discs all hang on these. */
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
      geometry: { type: 'Point', coordinates: anchorOf(venue, drawing) },
    });
  }
  return { type: 'FeatureCollection', features };
}

function shape(props: ShapeProps, rings: XY[][], origin: LngLat): Feature<Polygon, ShapeProps> {
  return {
    type: 'Feature',
    properties: props,
    geometry: { type: 'Polygon', coordinates: rings.map((ring) => closed(toDegrees(ring, origin))) },
  };
}

/**
 * The venue's own building, lit: a bright line along the edge of its roof and thin lines up its
 * corners, in the venue's colour (white when selected), as the mock draws a venue's block.
 * Nothing is drawn over the roof itself or the walls: those stay free (signs go there).
 *
 * Each shape is made once per zoom band (FRAME), in the width that looks right at that zoom.
 * Heights are plain metres; the layer style stretches them the same way as the city's buildings.
 */
export function venueShapes(
  venues: readonly VenueSummary[],
  drawing: VenueDrawing,
): FeatureCollection<Polygon, ShapeProps> {
  const features: Feature<Polygon, ShapeProps>[] = [];
  if (drawing.flat) return { type: 'FeatureCollection', features };

  for (const venue of venues) {
    const footprint = drawing.footprints?.[venue.id];
    if (!footprint || !isOnEarth(venue)) continue;
    const ghost = drawing.mode === 'mine' && !drawing.earned.has(venue.id);
    if (ghost) continue;

    const origin = footprint.centroid;
    const outline = tidy(toMetres(footprint.ring, origin));
    if (outline.length < 3) continue;
    const selected = venue.id === drawing.selectedId;
    const color = drawing.mode === 'mine' ? colors.earned : crowdColor(venue.crowdLevel);
    const roof = footprint.height + BUILDINGS.roofCapM;
    const room = narrowSide(outline) * FRAME.maxShareOfRoof;
    const outer = inset(outline, -FRAME.overhangM);

    FRAME.widthM.forEach((bandWidth, band) => {
      const width = Math.max(0.3, Math.min(bandWidth, room));
      features.push(
        shape(
          {
            id: venue.id,
            kind: 'frame',
            band,
            base: roof,
            top: roof + FRAME.depthM,
            fill: selected ? WHITE : mixHex(color, WHITE, FRAME.white),
            selected,
          },
          // The outer edge one way round, the hole the other way, as GeoJSON wants.
          [outer, reversed(inset(outline, width))],
          origin,
        ),
      );
      const side = Math.max(0.3, width * FRAME.postShare);
      for (const corner of sharpCorners(outer, FRAME.postMinTurnDeg, FRAME.postMax)) {
        features.push(
          shape(
            {
              id: venue.id,
              kind: 'post',
              band,
              base: footprint.minHeight,
              top: roof + FRAME.depthM,
              fill: selected ? WHITE : mixHex(color, PALETTE.ground, FRAME.postDim),
              selected,
            },
            [squareAround(corner, side)],
            origin,
          ),
        );
      }
    });
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
