// Everything about the city map that is a number, a name or a switch lives here.
// The hex colours in PALETTE are paint for the drawn city (an illustration), taken from the mock's
// canvas code in design-proposals/afterglow-concept.html; the interface itself uses @/theme.

/** A map coordinate the way Mapbox and GeoJSON order it: longitude first. */
export type LngLat = [longitude: number, latitude: number];

// ── Switches ────────────────────────────────────────────────────────────────
// Flip one of these if something looks wrong on the phone. Each is read once at render.

export const SWITCH = {
  /** Repaint dark-v11's own layers (land, water, roads, labels) in the city's colours. */
  restyleBasemap: true as boolean,
  /**
   * Lit windows on the buildings: a small facade image (assets/images/city-facade.png) repeated
   * over the walls. `false` paints the walls plain dark violet. Turn off if the walls look striped,
   * blurry or empty on the phone.
   */
  facadePattern: true as boolean,
  /** The glowing violet street lines over dark-v11's roads. */
  streetGlow: true as boolean,
  /** The violet haze towards the horizon. */
  atmosphere: true as boolean,
  /** A cool violet light on the buildings. `false` leaves the style's own light. */
  // Off: the package hands <Light> its colour as a number, which Mapbox rejects and paints red
  // ("Unexpeted value for color ... retuning red" on the first device test).
  light: false as boolean,
  /**
   * `true`: the glowing ring sits on top of each beam. `false`: at its foot.
   * (In the mock the ring sits on the venue's roof, where the beam starts.)
   */
  ringAtTop: true as boolean,
  /** The camera drop on the first open of the day. */
  cameraDrop: true as boolean,
} as const;

// ── Style ───────────────────────────────────────────────────────────────────

/** Mapbox's classic dark style. Its own layers are repainted by `city-style.tsx`. */
export const MAP_STYLE_URL = 'mapbox://styles/mapbox/dark-v11';
/** The vector source every dark-v11 layer draws from (Mapbox Streets v8 and friends). */
export const BASEMAP_SOURCE = 'composite';

/** dark-v11's own layer ids, as fetched from the style document (Nov 2026). */
export const BASEMAP_LAYER = {
  land: 'land',
  landStructure: 'land-structure-polygon',
  landuse: 'landuse',
  nationalPark: 'national-park',
  water: 'water',
  waterway: 'waterway',
  building: 'building',
  roads: ['road-simple', 'bridge-simple', 'bridge-case-simple', 'tunnel-simple', 'road-pedestrian', 'road-path'],
  rails: ['road-rail', 'bridge-rail'],
  poiLabel: 'poi-label',
  airportLabel: 'airport-label',
  roadLabel: 'road-label-simple',
  /** Place and water names: kept, softened. */
  labels: [
    'settlement-subdivision-label',
    'settlement-minor-label',
    'settlement-major-label',
    'natural-point-label',
    'water-point-label',
    'water-line-label',
    'waterway-label',
  ],
  /**
   * The city's own layers are inserted just under this one, so they sit above dark-v11's roads and
   * under its borders and labels.
   */
  insertBelow: 'admin-1-boundary-bg',
} as const;

export const PALETTE = {
  ground: '#08060f',
  park: '#0c0a17',
  water: '#070d26',
  waterEdge: '#465aff',
  road: '#141026',
  rail: '#120e22',
  roof: '#1c1934',
  wall: '#1d1836',
  street: '#9d6bff',
  streetCore: '#b99bff',
  label: '#cdbfff',
  haze: '#1a0b33',
  hazeHigh: '#0b0618',
  space: '#06040e',
  light: '#d9ceff',
} as const;

/** The facade image, registered under this name; 60×56 px drawn at 2× (30×28 pt). */
export const FACADE_IMAGE = 'city-facade';
export const FACADE_IMAGE_SCALE = 2;
/** A 2×2 white square, stretched behind the selected venue's name. */
export const LABEL_BOX_IMAGE = 'city-label-box';
export const LABEL_BOX_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGP8////fwYGBgYmBigAAD34BADaOyqcAAAAAElFTkSuQmCC';

export const BUILDINGS = {
  /** Mapbox Streets carries buildings from zoom 13. */
  minZoom: 13,
  /**
   * Podgorica is low; zoomed out far enough to see every venue its buildings would be a few
   * points tall. The map stretches them upwards, more when far out, less when close.
   */
  verticalScale: [13, 2.6, 15, 1.8, 17, 1.2] as const,
  opacity: 0.95,
  ambientOcclusion: 0.35,
  /** Metres: the slab laid over each roof so the facade image does not show on top. */
  roofCapM: 0.6,
} as const;

// ── Camera ──────────────────────────────────────────────────────────────────

export const CITY = {
  name: 'Podgorica',
  /**
   * Where the camera looks. Worked out from the seven demo venues (api/venues): with the tilt and
   * heading below, it puts all of them on an iPhone screen between the heading and the controls,
   * with room for their names. It lies south of their middle because a tilted camera shows more
   * of what is far away.
   */
  center: [19.2603, 42.4372] as LngLat,
} as const;

export const CAMERA = {
  /**
   * Close, as in the mock: a few streets around Stara Varoš with their buildings standing up.
   * Not every venue fits; the rest are a pan away. (13.35 showed the whole town as a flat map.)
   */
  zoom: 15.1,
  /** Tilted is how the city is meant to be seen. */
  pitch: 60,
  heading: -17,
  /** How close locate-me goes. */
  locateZoom: 15.2,
  /** Below this pitch the map counts as flat (2D); above `tiltedAbovePitch` as tilted. */
  flatBelowPitch: 10,
  tiltedAbovePitch: 20,
  /** Durations in milliseconds; the map does the easing. */
  tiltMs: 700,
  focusMs: 450,
  flyMs: 1400,
  routeMs: 900,
  /** First open of the day: from straight above and further out, down into the tilted city. */
  drop: { zoomOut: 1.6, pitch: 0, heading: 0, ms: 900 },
} as const;

/**
 * The welcome screen's backdrop (S-01): further out and steeper, and pushed down by `paddingTop`
 * points so the beams stand in the middle of the screen under the logo.
 */
export const BACKDROP_CAMERA = {
  center: [19.2612, 42.4385] as LngLat,
  zoom: 15.0,
  pitch: 62,
  heading: -17,
  paddingTop: 200,
} as const;

/**
 * The venue itself, as in the mock: a block a little taller than its neighbours with a bright edge
 * on its roof, and the beam rising from that roof.
 */
export const VENUE_BLOCK = {
  halfM: 15,
  heightM: 30,
  edgeM: 2.5,
  edgeDepthM: 1.2,
  fill: '#2b2253',
} as const;

/** Remembers the day of the last camera drop. */
export const DROP_DAY_KEY = '@findmyparty/city-drop-day';

// ── Beams ───────────────────────────────────────────────────────────────────

export const BEAM = {
  /** Radii in metres: the white core, the coloured beam, the faint wider one, the ring. */
  coreRadiusM: 3,
  beamRadiusM: 8,
  haloRadiusM: 20,
  ringOuterM: 17,
  ringInnerM: 12,
  /** How tall the ring is, in metres. */
  ringDepthM: 4,
  /** Corners of the polygon that stands in for a circle. */
  points: 24,
  /** Height in metres by strength (0 nothing known, 0.2 quiet, 1 the busiest). */
  heightAtNothing: 60,
  heightAtQuiet: 140,
  heightAtBusiest: 620,
  /** In My City every lit venue gets the same beam: it is a collection, not a crowd. */
  heightEarned: 380,
  heightGhost: 40,
  /**
   * The beam in three stacked pieces, brightest at the foot, like the mock's fading beam.
   * `to` is the share of the beam's height where the piece ends.
   */
  pieces: [
    { to: 0.45, opacity: 0.95 },
    { to: 0.75, opacity: 0.7 },
    { to: 1, opacity: 0.42 },
  ],
  /** The white core runs up this share of the beam. */
  coreShare: 0.8,
  coreOpacity: 0.9,
  /** The faint wider beam runs up this share. */
  haloShare: 0.6,
  opacityHalo: 0.16,
  opacityGhost: 0.22,
  /** Close in, beams shrink so they do not leave the screen: factor at each zoom. */
  scaleByZoom: [13, 1.4, 15, 1, 17, 0.55] as const,
  /** How much white goes into the ring, and into the foot of the beam. */
  ringWhite: 0.72,
  footWhite: 0.3,
  /** An expected crowd is drawn this much darker than a live one. */
  expectedDim: 0.3,
} as const;

// ── Labels ──────────────────────────────────────────────────────────────────

export const LABEL = {
  size: 15,
  countSize: 10.5,
  selectedSize: 14,
  ghostSize: 12.5,
  /**
   * Closer than this every venue is named; further out only the busy ones and the selected one.
   * The map checks a filter's zoom once per whole zoom level, so in practice this switches at 14.
   */
  allFromZoom: 13.5,
  /** "Busy" for the rule above. */
  minStrength: 0.4,
  /**
   * `true`: the name floats at the top of its beam (the map lifts it by the beam's height).
   * `false`: the name sits beside the beam's foot. Flip if lifted labels misbehave on a device.
   */
  atBeamTop: true as boolean,
} as const;

// ── Ids ─────────────────────────────────────────────────────────────────────
// Sources and layers are looked up by id inside the map, so each must be unique.

export const SOURCE = {
  route: 'city-route',
  venuePoints: 'city-venue-points',
  beams: 'city-beams',
  labels: 'city-venue-labels',
} as const;

export const LAYER = {
  venueBlock: 'city-venue-block',
  venueEdge: 'city-venue-edge',
  waterEdge: 'city-water-edge',
  streetGlow: 'city-street-glow',
  streetCore: 'city-street-core',
  buildings: 'city-buildings',
  roofs: 'city-roofs',
  routeGlow: 'city-route-glow',
  routeLine: 'city-route-line',
  routeCore: 'city-route-core',
  discGlow: 'city-disc-glow',
  disc: 'city-disc',
  discDot: 'city-disc-dot',
  discRing: 'city-disc-ring',
  beamCore: 'city-beam-core',
  beamPiece: 'city-beam-piece-',
  beamGhost: 'city-beam-ghost',
  beamRing: 'city-beam-ring',
  beamHalo: 'city-beam-halo',
  labelNames: 'city-label-names',
  labelCounts: 'city-label-counts',
  labelSelected: 'city-label-selected',
  youGlow: 'city-you-glow',
  youCentre: 'city-you-centre',
  youDot: 'city-you-dot',
} as const;

/** Finger-sized square around a tap in which venues are looked for. */
export const TAP_HITBOX = { width: 48, height: 48 } as const;

/** What the venue sheet's height is taken to be until it has been measured once. */
export const SHEET_HEIGHT_GUESS = 360;
/** Room kept between the selected beam's foot and the top of the sheet. */
export const SHEET_CUSHION = 28;
