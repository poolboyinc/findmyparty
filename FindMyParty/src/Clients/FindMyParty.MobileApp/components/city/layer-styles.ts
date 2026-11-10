// How each map layer is painted. Every property and expression operator used here exists in
// node_modules/@rnmapbox/maps/src/utils/MapboxStyles.ts. Expressions are kept to the plain ones
// (get, ==, !=, >=, all, case, step, interpolate, zoom, +, -, *): on iOS the package decodes text and
// colour expressions with `try!`, so an exotic one would crash the app instead of being ignored.

import type { ComponentProps } from 'react';
import type {
  CircleLayer,
  CircleLayerStyle,
  FillExtrusionLayerStyle,
  LineLayerStyle,
  SymbolLayerStyle,
} from '@rnmapbox/maps';
import { colors } from '@/theme';
import { BEAM, LABEL } from './constants';

/** A Mapbox expression, as the package types it. */
type Expr = Extract<NonNullable<CircleLayerStyle['circleRadius']>, readonly unknown[]>;
type Num = number | Expr;
export type LayerFilter = NonNullable<ComponentProps<typeof CircleLayer>['filter']>;

/** Under the night light a layer is drawn dark unless it gives off its own light. 1 is fully lit. */
const LIT = 1;
const QUICK = { duration: 300, delay: 0 } as const;

const STRENGTH: Expr = ['get', 'strength'];
const COLOR: Expr = ['get', 'color'];
const IS_SELECTED: Expr = ['==', ['get', 'selected'], true];
const IS_EXPECTED: Expr = ['==', ['get', 'expected'], true];

/** A size that grows as the map zooms in. */
function byZoom(far: Num, mid: Num, near: Num): Expr {
  return ['interpolate', ['linear'], ['zoom'], 11, far, 14, mid, 17, near];
}

/** `base` for an empty venue, up to `base + gain` for the busiest. */
function withStrength(base: number, gain: number): Expr {
  return ['+', base, ['*', gain, STRENGTH]];
}

// ── Filters ─────────────────────────────────────────────────────────────────

export const FILTER = {
  beamLive: ['all', ['==', ['get', 'kind'], 'core'], ['!=', ['get', 'expected'], true]],
  beamExpected: ['all', ['==', ['get', 'kind'], 'core'], IS_EXPECTED],
  beamHalo: ['==', ['get', 'kind'], 'halo'],
  selected: IS_SELECTED,
  /** Not the selected one (it has its own layer), and when zoomed out only the busy ones. */
  labels: [
    'all',
    ['!=', ['get', 'selected'], true],
    ['step', ['zoom'], ['>=', STRENGTH, LABEL.minStrength], LABEL.allFromZoom, true],
  ],
} as const satisfies Record<string, LayerFilter>;

// ── Beams ───────────────────────────────────────────────────────────────────

/** Metres of beam for a venue's strength: a stub when nothing is known, tallest when busiest. */
export const BEAM_HEIGHT: Expr = [
  'interpolate',
  ['linear'],
  STRENGTH,
  0,
  BEAM.heightAtNothing,
  0.2,
  BEAM.heightAtQuiet,
  1,
  BEAM.heightAtBusiest,
];

/** A beam. In flat (2D) mode beams are switched off and the discs carry the picture. */
export function beamStyle(opacity: number, flat: boolean): FillExtrusionLayerStyle {
  return {
    visibility: flat ? 'none' : 'visible',
    fillExtrusionColor: COLOR,
    fillExtrusionHeight: BEAM_HEIGHT,
    // Applies when this style's height changes; fresh venue data is redrawn by the map as it arrives.
    fillExtrusionHeightTransition: { duration: 600, delay: 0 },
    fillExtrusionOpacity: opacity,
    fillExtrusionEmissiveStrength: LIT,
    // A beam is light, not a wall: the same brightness from foot to top.
    fillExtrusionVerticalGradient: false,
  };
}

/** For the fallback style only: the city's buildings in dark violet. */
export const BUILDINGS_STYLE: FillExtrusionLayerStyle = {
  fillExtrusionColor: colors.surfaceHigh,
  fillExtrusionHeight: ['get', 'height'],
  fillExtrusionBase: ['get', 'min_height'],
  fillExtrusionOpacity: 0.9,
};
export const BUILDINGS_FILTER: LayerFilter = ['==', ['get', 'extrude'], 'true'];

// ── Discs at the beams' feet ────────────────────────────────────────────────

/** The soft pool of light on the ground. In flat mode it grows with the crowd. */
export function discGlowStyle(flat: boolean): CircleLayerStyle {
  return {
    circleColor: COLOR,
    circleRadius: flat
      ? byZoom(withStrength(5, 5), withStrength(12, 16), withStrength(22, 26))
      : byZoom(5, 13, 30),
    circleRadiusTransition: QUICK,
    circleBlur: 0.9,
    // An expected crowd glows less than one that is really there.
    circleOpacity: ['case', IS_EXPECTED, 0.3, 0.55],
    circlePitchAlignment: 'map',
    circlePitchScale: 'map',
    circleEmissiveStrength: LIT,
  };
}

/** The solid disc. Small under a beam; in flat mode it is the venue's mark, sized by the crowd. */
export function discStyle(flat: boolean): CircleLayerStyle {
  return {
    circleColor: COLOR,
    circleRadius: flat ? byZoom(withStrength(2.5, 3), withStrength(6, 9), withStrength(10, 14)) : byZoom(2, 3.5, 7),
    circleRadiusTransition: QUICK,
    circleBlur: 0.1,
    circleOpacity: 0.95,
    circleStrokeColor: colors.label,
    circleStrokeWidth: flat ? 1.5 : 0,
    circleStrokeOpacity: 0.6,
    circlePitchAlignment: 'map',
    circlePitchScale: 'map',
    circleEmissiveStrength: LIT,
  };
}

/** A white ring around the selected venue's disc. */
export function discRingStyle(flat: boolean): CircleLayerStyle {
  return {
    circleColor: colors.label,
    circleOpacity: 0,
    circleRadius: flat ? byZoom(withStrength(6, 3), withStrength(10, 9), withStrength(15, 14)) : byZoom(5, 8, 13),
    circleRadiusTransition: QUICK,
    circleStrokeColor: colors.label,
    circleStrokeWidth: 2,
    circlePitchAlignment: 'map',
    circlePitchScale: 'map',
    circleEmissiveStrength: LIT,
  };
}

// ── Labels ──────────────────────────────────────────────────────────────────

/**
 * Venue names set straight on the map: white with a dark edge, no box, the style's own font.
 * Tilted, the map lifts each name to the top of its beam (`symbolZOffset`, metres above ground);
 * flat, it sits just above the disc.
 */
export function labelStyle(flat: boolean, selected: boolean): SymbolLayerStyle {
  const lifted = LABEL.atBeamTop && !flat;
  const beside = !LABEL.atBeamTop && !flat;
  return {
    textField: ['get', 'text'],
    textSize: selected ? LABEL.selectedSize : LABEL.size,
    textLineHeight: 1.25,
    textMaxWidth: 9,
    textColor: colors.label,
    textHaloColor: colors.bg,
    textHaloWidth: 1.5,
    textEmissiveStrength: LIT,
    textAnchor: beside ? 'left' : 'bottom',
    textJustify: beside ? 'left' : 'center',
    textOffset: beside ? [1.1, 0] : lifted ? [0, -0.5] : [0, -1.7],
    symbolZOffset: lifted ? BEAM_HEIGHT : 0,
    // Busy venues get their place first; the selected one is never hidden by a neighbour.
    symbolSortKey: ['-', 1, STRENGTH],
    textAllowOverlap: selected,
  };
}

// ── Route ───────────────────────────────────────────────────────────────────

export const ROUTE_GLOW_STYLE: LineLayerStyle = {
  lineColor: colors.you,
  lineWidth: 13,
  lineOpacity: 0.25,
  lineBlur: 5,
  lineCap: 'round',
  lineJoin: 'round',
  lineEmissiveStrength: LIT,
};

export const ROUTE_LINE_STYLE: LineLayerStyle = {
  lineColor: colors.you,
  lineWidth: 4.5,
  lineCap: 'round',
  lineJoin: 'round',
  lineEmissiveStrength: LIT,
};

// ── You ─────────────────────────────────────────────────────────────────────

export const YOU_GLOW_STYLE: CircleLayerStyle = {
  circleColor: colors.you,
  circleRadius: 18,
  circleBlur: 0.7,
  circleOpacity: 0.4,
  circlePitchAlignment: 'map',
  circleEmissiveStrength: LIT,
};

export const YOU_RING_STYLE: CircleLayerStyle = {
  circleColor: colors.bg,
  circleRadius: 9,
  circlePitchAlignment: 'map',
  circleEmissiveStrength: LIT,
};

export const YOU_DOT_STYLE: CircleLayerStyle = {
  circleColor: colors.you,
  circleRadius: 6,
  circlePitchAlignment: 'map',
  circleEmissiveStrength: LIT,
};
