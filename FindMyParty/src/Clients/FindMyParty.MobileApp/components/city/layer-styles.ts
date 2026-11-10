// How each map layer is painted. Every property and expression operator used here exists in
// node_modules/@rnmapbox/maps/src/utils/MapboxStyles.ts and has a setter in
// node_modules/@rnmapbox/maps/ios/RNMBX/RNMBXStyle.swift. Expressions are kept to the plain ones
// (get, ==, !=, >=, all, any, case, match, step, interpolate, zoom, geometry-type, +, -, *): on iOS
// the package decodes text and colour expressions with `try!`, so an exotic one would crash the app
// instead of being ignored. No `format`, no `literal`: arrays come from feature properties.
//
// The city runs on dark-v11, a classic style with a flat light. There the emissive-strength
// properties of Mapbox Standard do nothing, so brightness comes from the colours themselves.

import type { ComponentProps } from 'react';
import type {
  AtmosphereLayerStyle as AtmosphereLayerStyleProps,
  BackgroundLayerStyle as BackgroundLayerStyleProps,
  CircleLayer,
  CircleLayerStyle as CircleLayerStyleProps,
  FillExtrusionLayerStyle as FillExtrusionLayerStyleProps,
  FillLayerStyle as FillLayerStyleProps,
  LightLayerStyle as LightLayerStyleProps,
  LineLayerStyle as LineLayerStyleProps,
  SymbolLayerStyle as SymbolLayerStyleProps,
} from '@rnmapbox/maps';
import { colors } from '@/theme';
import { BEAM, BUILDINGS, FACADE_IMAGE, LABEL, LABEL_BOX_IMAGE, PALETTE } from './constants';

/** A Mapbox expression, as the package types it. */
type Expr = Extract<NonNullable<CircleLayerStyleProps['circleRadius']>, readonly unknown[]>;
type Num = number | Expr;
export type LayerFilter = NonNullable<ComponentProps<typeof CircleLayer>['filter']>;

const QUICK = { duration: 300, delay: 0 } as const;

const STRENGTH: Expr = ['get', 'strength'];
const COLOR: Expr = ['get', 'color'];
const IS_SELECTED: Expr = ['==', ['get', 'selected'], true];
const IS_EXPECTED: Expr = ['==', ['get', 'expected'], true];
const IS_GHOST: Expr = ['==', ['get', 'ghost'], true];
const KIND = (kind: string): Expr => ['==', ['get', 'kind'], kind];

/** A size that grows as the map zooms in. */
function byZoom(far: Num, mid: Num, near: Num): Expr {
  return ['interpolate', ['linear'], ['zoom'], 11, far, 14, mid, 17, near];
}

/** `base` for an empty venue, up to `base + gain` for the busiest. */
function withStrength(base: number, gain: number): Expr {
  return ['+', base, ['*', gain, STRENGTH]];
}

/** A height property in metres, shrunk as the map zooms in (beams stay on screen close up). */
function beamMetres(property: string): Expr {
  const [z0, f0, z1, f1, z2, f2] = BEAM.scaleByZoom;
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    z0,
    ['*', f0, ['get', property]],
    z1,
    ['*', f1, ['get', property]],
    z2,
    ['*', f2, ['get', property]],
  ];
}

// ── Filters ─────────────────────────────────────────────────────────────────

/** Names: always in My City; in Live, further out only the busy ones. Never the selected one. */
const NAMED: Expr = [
  'all',
  ['!=', ['get', 'selected'], true],
  [
    'any',
    ['==', ['get', 'mode'], 'mine'],
    ['step', ['zoom'], ['>=', STRENGTH, LABEL.minStrength], LABEL.allFromZoom, true],
  ],
];

/** Mapbox Streets road classes that get a glowing line. A plain array: the package types want it mutable. */
const STREET_CLASSES: string[] = [
  'motorway',
  'motorway_link',
  'trunk',
  'trunk_link',
  'primary',
  'primary_link',
  'secondary',
  'secondary_link',
  'tertiary',
  'tertiary_link',
  'street',
  'street_limited',
  'pedestrian',
];

export const FILTER = {
  core: KIND('core'),
  piece: (index: number): LayerFilter => ['all', KIND('piece'), ['==', ['get', 'piece'], index]],
  ghost: KIND('ghost'),
  ring: KIND('ring'),
  halo: KIND('halo'),
  selected: IS_SELECTED,
  names: NAMED,
  counts: ['all', NAMED, ['!=', ['get', 'label'], '']],
  /** Mapbox Streets buildings that are meant to be drawn in 3D. */
  buildings: ['==', ['get', 'extrude'], 'true'],
  /** Every road a car or a person walks along, not paths, tracks or rails. */
  streets: ['all', ['==', ['geometry-type'], 'LineString'], ['match', ['get', 'class'], STREET_CLASSES, true, false]],
} as const;

// ── Basemap: dark-v11's own layers, repainted ───────────────────────────────

export const BASEMAP_STYLE = {
  land: { backgroundColor: PALETTE.ground } satisfies BackgroundLayerStyleProps,
  landFill: { fillColor: PALETTE.ground } satisfies FillLayerStyleProps,
  park: { fillColor: PALETTE.park } satisfies FillLayerStyleProps,
  water: { fillColor: PALETTE.water } satisfies FillLayerStyleProps,
  waterway: { lineColor: PALETTE.water } satisfies LineLayerStyleProps,
  hidden: { visibility: 'none' } as const,
  road: { lineColor: PALETTE.road } satisfies LineLayerStyleProps,
  rail: { lineColor: PALETTE.rail } satisfies LineLayerStyleProps,
  /** Street and place names: soft lavender on a dark edge, sentence case, not spaced out. */
  label: {
    textColor: PALETTE.label,
    textOpacity: 0.55,
    textHaloColor: PALETTE.ground,
    textHaloWidth: 1.2,
    textHaloBlur: 0.5,
    textTransform: 'none',
    textLetterSpacing: 0,
  } satisfies SymbolLayerStyleProps,
} as const;

/** The rim of rivers and lakes, as the mock draws the river: a thin blue-violet line. */
export const WATER_EDGE_STYLE: LineLayerStyleProps = {
  lineColor: PALETTE.waterEdge,
  lineOpacity: 0.45,
  lineWidth: byZoom(0.5, 0.9, 1.4),
  lineBlur: 0.6,
};

// ── Streets ─────────────────────────────────────────────────────────────────

/** 1 for the big roads, 0 for side streets. */
const MAJOR: Expr = [
  'match',
  ['get', 'class'],
  ['motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'tertiary'],
  1,
  0,
];

function byClass(major: number, minor: number): Expr {
  return ['+', minor, ['*', major - minor, MAJOR]];
}

/** The wide soft glow along each street. */
export const STREET_GLOW_STYLE: LineLayerStyleProps = {
  lineColor: PALETTE.street,
  lineWidth: ['interpolate', ['linear'], ['zoom'], 12, byClass(2.5, 0.8), 15, byClass(9, 3), 18, byClass(26, 9)],
  lineBlur: ['interpolate', ['linear'], ['zoom'], 12, byClass(2, 0.6), 15, byClass(7, 2.4), 18, byClass(20, 7)],
  lineOpacity: byClass(0.42, 0.14),
  lineCap: 'round',
  lineJoin: 'round',
};

/** The thin bright line in the middle of the glow. */
export const STREET_CORE_STYLE: LineLayerStyleProps = {
  lineColor: PALETTE.streetCore,
  lineWidth: ['interpolate', ['linear'], ['zoom'], 12, byClass(0.6, 0.25), 15, byClass(1.3, 0.5), 18, byClass(2.6, 1)],
  lineOpacity: byClass(0.85, 0.32),
  lineCap: 'round',
  lineJoin: 'round',
};

// ── Buildings ───────────────────────────────────────────────────────────────

const HEIGHT: Expr = ['get', 'height'];
const MIN_HEIGHT: Expr = ['get', 'min_height'];
const [vz0, vs0, vz1, vs1, vz2, vs2] = BUILDINGS.verticalScale;
const VERTICAL_SCALE: Expr = ['interpolate', ['linear'], ['zoom'], vz0, vs0, vz1, vs1, vz2, vs2];

/** Rises out of the ground over the first third of a zoom level, so tiles do not pop in flat. */
function growing(value: Expr): Expr {
  return ['interpolate', ['linear'], ['zoom'], BUILDINGS.minZoom, 0, BUILDINGS.minZoom + 0.3, value];
}

/**
 * The city's buildings in dark violet. With the facade image, the walls carry lit windows;
 * the image then replaces the colour, so the roofs get their own slab (`ROOF_STYLE`).
 */
export function buildingStyle(withFacade: boolean): FillExtrusionLayerStyleProps {
  return {
    fillExtrusionColor: PALETTE.wall,
    ...(withFacade ? { fillExtrusionPattern: FACADE_IMAGE } : {}),
    fillExtrusionHeight: growing(HEIGHT),
    fillExtrusionBase: growing(MIN_HEIGHT),
    fillExtrusionOpacity: BUILDINGS.opacity,
    // Darker at the foot of each wall, lighter towards the top.
    fillExtrusionVerticalGradient: true,
    fillExtrusionAmbientOcclusionIntensity: BUILDINGS.ambientOcclusion,
    fillExtrusionAmbientOcclusionRadius: 3,
    fillExtrusionVerticalScale: VERTICAL_SCALE,
  };
}

/** A thin slab on every roof, so roofs stay plain dark violet when the walls have windows. */
export const ROOF_STYLE: FillExtrusionLayerStyleProps = {
  fillExtrusionColor: PALETTE.roof,
  fillExtrusionBase: growing(HEIGHT),
  fillExtrusionHeight: growing(['+', HEIGHT, BUILDINGS.roofCapM]),
  fillExtrusionOpacity: 1,
  fillExtrusionVerticalGradient: false,
  fillExtrusionVerticalScale: VERTICAL_SCALE,
};

// ── Air and light ───────────────────────────────────────────────────────────

/** Violet haze towards the horizon, dark above it. Replaces dark-v11's black fog. */
export const ATMOSPHERE_STYLE: AtmosphereLayerStyleProps = {
  color: PALETTE.haze,
  highColor: PALETTE.hazeHigh,
  spaceColor: PALETTE.space,
  horizonBlend: 0.12,
  range: [1, 7],
  starIntensity: 0,
};

/**
 * A cool violet light, fixed to the screen, so walls facing the lower left read lighter.
 * Its position is left at Mapbox's default ([1.15, 210, 30]): on iOS with SDK v11 the package
 * converts the first number of `position` from degrees to radians (RNMBXStyleValue.swift,
 * getSphericalPosition), which would shrink the light's distance to almost nothing.
 */
export const LIGHT_STYLE: LightLayerStyleProps = {
  anchor: 'viewport',
  color: PALETTE.light,
  intensity: 0.4,
};

// ── Beams ───────────────────────────────────────────────────────────────────

/** One part of the beams. In flat (2D) mode beams are switched off and the discs carry the picture. */
export function beamStyle(opacity: number, flat: boolean): FillExtrusionLayerStyleProps {
  return {
    visibility: flat ? 'none' : 'visible',
    fillExtrusionColor: ['get', 'fill'],
    fillExtrusionBase: beamMetres('base'),
    fillExtrusionHeight: beamMetres('top'),
    fillExtrusionOpacity: opacity,
    // A beam is light, not a wall: the same brightness from foot to top.
    fillExtrusionVerticalGradient: false,
  };
}

// ── Discs at the beams' feet ────────────────────────────────────────────────

/** The soft pool of light on the ground. In flat mode it grows with the crowd. */
export function discGlowStyle(flat: boolean): CircleLayerStyleProps {
  return {
    circleColor: COLOR,
    circleRadius: flat
      ? byZoom(withStrength(8, 8), withStrength(16, 22), withStrength(30, 36))
      : byZoom(10, 26, 60),
    circleRadiusTransition: QUICK,
    circleBlur: 1,
    // An expected crowd glows less than one that is really there; a ghost not at all.
    circleOpacity: ['case', IS_GHOST, 0, IS_EXPECTED, 0.3, 0.5],
    circlePitchAlignment: 'map',
    circlePitchScale: 'map',
  };
}

/**
 * The disc. Under a beam a small solid spot; in flat mode the venue's mark, as in the mock:
 * a see-through disc with a solid edge, sized by the crowd. A My City ghost is an empty dim ring.
 */
export function discStyle(flat: boolean): CircleLayerStyleProps {
  return {
    circleColor: COLOR,
    circleRadius: flat
      ? byZoom(withStrength(3, 3), withStrength(6, 9), withStrength(10, 14))
      : ['case', IS_GHOST, byZoom(3, 6, 12), byZoom(2, 3.5, 7)],
    circleRadiusTransition: QUICK,
    circleOpacity: ['case', IS_GHOST, 0, flat ? 0.3 : 0.95],
    circleStrokeColor: ['case', IS_GHOST, colors.label, COLOR],
    circleStrokeWidth: ['case', IS_GHOST, 1, flat ? 1.5 : 0],
    circleStrokeOpacity: ['case', IS_GHOST, 0.4, 1],
    circlePitchAlignment: 'map',
    circlePitchScale: 'map',
  };
}

/** The white dot in the middle of a flat-mode disc. */
export function discDotStyle(flat: boolean): CircleLayerStyleProps {
  return {
    visibility: flat ? 'visible' : 'none',
    circleColor: colors.label,
    circleRadius: 2.2,
    circleOpacity: ['case', IS_GHOST, 0, 1],
    circlePitchAlignment: 'map',
  };
}

/** A white ring around the selected venue's disc. */
export function discRingStyle(flat: boolean): CircleLayerStyleProps {
  return {
    circleColor: colors.label,
    circleOpacity: 0,
    circleRadius: flat ? byZoom(withStrength(6, 3), withStrength(10, 9), withStrength(15, 14)) : byZoom(5, 8, 13),
    circleRadiusTransition: QUICK,
    circleStrokeColor: colors.label,
    circleStrokeWidth: 2,
    circlePitchAlignment: 'map',
    circlePitchScale: 'map',
  };
}

// ── Labels ──────────────────────────────────────────────────────────────────

/** dark-v11's own font, so no extra glyphs are downloaded. Coolvetica cannot be used on the map. */
const MAP_FONT = ['DIN Pro Medium', 'Arial Unicode MS Regular'];

/** Above its beam when tilted (the map lifts it by the beam's height), on the ground when flat. */
function labelPlacement(flat: boolean): Pick<SymbolLayerStyleProps, 'symbolZOffset' | 'textAnchor' | 'textJustify'> {
  const beside = !LABEL.atBeamTop && !flat;
  return {
    symbolZOffset: flat || !LABEL.atBeamTop ? 0 : beamMetres('lift'),
    textAnchor: beside ? 'left' : 'bottom',
    textJustify: beside ? 'left' : 'center',
  };
}

/** Venue names set straight on the map: white with a dark edge, no box. A ghost's is dim. */
export function nameStyle(flat: boolean): SymbolLayerStyleProps {
  return {
    ...labelPlacement(flat),
    textField: ['get', 'name'],
    textFont: MAP_FONT,
    textSize: ['get', 'nameSize'],
    textMaxWidth: 9,
    textColor: ['get', 'nameColor'],
    textHaloColor: colors.bg,
    textHaloWidth: 1.6,
    textHaloBlur: 0.6,
    textOffset: ['get', 'nameOffset'],
    // Busy venues get their place first.
    symbolSortKey: ['-', 1, STRENGTH],
    textAllowOverlap: true,
  };
}

/** The crowd under the name ("200+"), small, in the venue's own colour. */
export function countStyle(flat: boolean): SymbolLayerStyleProps {
  return {
    ...labelPlacement(flat),
    textField: ['get', 'label'],
    textFont: MAP_FONT,
    textSize: LABEL.countSize,
    textColor: COLOR,
    textHaloColor: colors.bg,
    textHaloWidth: 1.4,
    textHaloBlur: 0.5,
    textOffset: ['get', 'countOffset'],
    textAllowOverlap: true,
    textIgnorePlacement: true,
  };
}

/** The selected venue: dark type on a white block, name and crowd on two lines (S-05). */
export function selectedLabelStyle(flat: boolean): SymbolLayerStyleProps {
  return {
    ...labelPlacement(flat),
    textField: ['get', 'text'],
    textFont: MAP_FONT,
    textSize: LABEL.selectedSize,
    textLineHeight: 1.15,
    textColor: colors.ink,
    textOffset: [0, flat ? -1.6 : -0.6],
    textAllowOverlap: true,
    textIgnorePlacement: true,
    iconImage: LABEL_BOX_IMAGE,
    iconTextFit: 'both',
    // Points around the text: top, right, bottom, left.
    iconTextFitPadding: [5, 9, 4, 9],
    iconAllowOverlap: true,
    iconIgnorePlacement: true,
  };
}

// ── Route ───────────────────────────────────────────────────────────────────

export const ROUTE_GLOW_STYLE: LineLayerStyleProps = {
  lineColor: colors.you,
  lineWidth: 14,
  lineOpacity: 0.3,
  lineBlur: 8,
  lineCap: 'round',
  lineJoin: 'round',
};

export const ROUTE_LINE_STYLE: LineLayerStyleProps = {
  lineColor: colors.you,
  lineWidth: 4.5,
  lineCap: 'round',
  lineJoin: 'round',
};

/** The thin white line down the middle of the route, as in the mock. */
export const ROUTE_CORE_STYLE: LineLayerStyleProps = {
  lineColor: colors.label,
  lineWidth: 1.4,
  lineOpacity: 0.9,
  lineCap: 'round',
  lineJoin: 'round',
};

// ── You ─────────────────────────────────────────────────────────────────────

/** A cyan disc on the ground around you; tilted, it lies flat as an ellipse like the mock's. */
export const YOU_GLOW_STYLE: CircleLayerStyleProps = {
  circleColor: colors.you,
  circleRadius: 20,
  circleOpacity: 0.2,
  circleStrokeColor: colors.you,
  circleStrokeWidth: 1.2,
  circleStrokeOpacity: 0.7,
  circlePitchAlignment: 'map',
};

export const YOU_DOT_STYLE: CircleLayerStyleProps = {
  circleColor: colors.you,
  circleRadius: 6,
};

/** The white centre of your dot. */
export const YOU_CENTRE_STYLE: CircleLayerStyleProps = {
  circleColor: colors.label,
  circleRadius: 2.5,
};
