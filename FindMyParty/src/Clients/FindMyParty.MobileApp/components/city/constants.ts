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
   * `true`: beams grow a little as the map zooms in and shrink as it zooms out (SPRITE.sizeByZoom).
   * Off, because the map moves a name only at whole zoom levels while it resizes a beam all the
   * time, so between whole levels the name would hang up to 30 points off the tip of its beam.
   * With one size at every zoom the name sits exactly on the tip.
   */
  beamsScaleWithZoom: false as boolean,
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
  roof: '#110f24',
  wall: '#1d1836',
  street: '#9d6bff',
  streetCore: '#b99bff',
  label: '#cdbfff',
  haze: '#1a0b33',
  hazeHigh: '#0b0618',
  space: '#06040e',
  light: '#d9ceff',
} as const;

/**
 * The facade image, registered under this name; 60×56 px drawn at 2× (30×28 pt). Its pixels per
 * point come from the file's name (`city-facade@2x.png`), as for every picture the map uses:
 * a `scale` given to the map's `<Images>` is ignored for bundled files in a release build.
 */
export const FACADE_IMAGE = 'city-facade';
export const FACADE_IMAGE_SCALE = 2;
/**
 * The white block behind the selected venue's name (assets/images/city/label-box@3x.png): 24 px square
 * at 3×, with rounded corners. Only its middle stretches, so the corners stay crisp.
 */
export const LABEL_BOX_IMAGE = 'city-label-box';
export const LABEL_BOX = {
  pixelRatio: 3,
  /** Pixels of the image, from and to, that may stretch: the same sideways and upwards. */
  stretch: [[9, 15]] as [number, number][],
} as const;

export const BUILDINGS = {
  /**
   * Mapbox Streets carries every building only from zoom 15; further out just a few big ones,
   * which look like litter. So buildings start here, rising out of the ground as you zoom in
   * (and below this zoom the map lays itself flat: CAMERA.flattenBelowZoom).
   */
  minZoom: 15,
  /**
   * Podgorica is low. Every height on the map (buildings, the lit roof lines, where beams and
   * signs stand) is stretched upwards by this, so the city reads as a city when tilted.
   */
  stretch: 1.5,
  /** Buildings rise out of the ground over this much zoom past `minZoom`, so tiles do not pop in. */
  riseOverZoom: 0.3,
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
  center: [19.2632, 42.4419] as LngLat,
} as const;

export const CAMERA = {
  /**
   * Close, as in the mock: a few streets around Stara Varoš with their buildings standing up.
   * Not every venue fits; the rest are a pan away. (13.35 showed the whole town as a flat map.)
   */
  zoom: 16.15,
  /** Tilted is how the city is meant to be seen. */
  pitch: 60,
  heading: -17,
  /**
   * Further out than this the buildings thin out (map tiles carry only the big ones) and beams
   * would stand on bare streets, so the map lays itself flat, as the mock says it should; zoomed
   * back in past `tiltAgainAboveZoom` it tilts up again by itself.
   */
  flattenBelowZoom: 15,
  tiltAgainAboveZoom: 15.3,
  /** How close locate-me goes. */
  locateZoom: 16.2,
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
  center: [19.2634, 42.4411] as LngLat,
  zoom: 15.9,
  pitch: 62,
  heading: -17,
  paddingTop: 200,
} as const;

/**
 * The venue's own building, lit as in the mock: a bright line along the edge of its roof and thin
 * lines up its corners. Both are real 3D shapes sized in metres, so each is drawn once per zoom
 * level (`bands`) to stay about a point and a half wide on screen at any zoom.
 */
export const FRAME = {
  /** A band starts at each of these zoom levels; the first band covers everything further out. */
  bandFromZoom: [14, 15, 16, 17] as const,
  /** Width of the roof line in metres, per band (one more entry than `bandFromZoom`). */
  widthM: [9, 4.9, 2.5, 1.25, 0.62] as const,
  /** Never wider than this share of the building's short side. */
  maxShareOfRoof: 0.2,
  /** How far the line stands above the roof, and how far it overhangs the walls, in metres. */
  depthM: 0.7,
  overhangM: 0.15,
  /** Corner lines: this share of the roof line's width, on corners that turn at least this much. */
  postShare: 0.7,
  postMinTurnDeg: 30,
  postMax: 8,
  /** How much white goes into the roof line, and how far the corner lines are dimmed. */
  white: 0.25,
  postDim: 0.4,
} as const;

/** Remembers the day of the last camera drop. */
export const DROP_DAY_KEY = '@findmyparty/city-drop-day';

// ── Beams ───────────────────────────────────────────────────────────────────
// A beam is a picture of light (assets/images/city/beam-*@3x.png, drawn by
// tools/city-preview/make-sprites.mjs exactly as the mock draws its beams) that stands upright on
// the venue's roof and always faces the camera. Its size is in points on the screen, not metres,
// so zooming in makes the building bigger and leaves the beam slim.

export const SPRITE = {
  /** The mock's sizes are for a 286 pt wide screen; an iPhone is 393 pt. */
  mockScale: 1.37,
  /** Pixels per point in the image files. */
  pixelRatio: 3,
  /** Points from the centre of the pool of light at the beam's foot to the bottom of the image. */
  haloPt: 22 * 1.37,
  /** In My City every lit venue gets the same beam: it is a collection, not a crowd. */
  earnedHeat: 0.45,
  /** Size of the beam at each zoom: [zoom, size, zoom, size, zoom, size]. */
  sizeByZoom: [13, 0.55, 15.5, 1, 18, 1.4] as const,
  /** The ring lies on the roof, so it grows faster, more like the roof itself. */
  ringByZoom: [13, 0.45, 15.5, 1, 18, 2.4] as const,
} as const;

/**
 * "A slow ring pulses from the roof of busy venues" (the mock's motion table): three ripples, each
 * wider and fainter than the one before, lit one after another, then a rest.
 */
export const PULSE = {
  /** Size of each ripple, as a multiple of the roof ring's own size. */
  sizes: [0.72, 1.02, 1.36] as const,
  opacity: [0.85, 0.55, 0.3] as const,
  /** One step of the pulse; four steps (three ripples and a rest) make the mock's 2.4 s. */
  stepMs: 600,
  fadeMs: 650,
} as const;

/**
 * Signs (S-19). They belong to the street, so they only show once the map is close enough to
 * read them; a hologram is sized in points like a beam, a wall panel in metres like its wall.
 */
export const SIGN = {
  fromZoom: 15.6,
  /** Size of a hologram at each zoom: [zoom, size, …]. */
  hologramByZoom: [15.6, 0.7, 16.5, 1, 18, 1.5] as const,
  tagByZoom: [15.6, 0.8, 17, 1, 18.5, 1.25] as const,
  /** Metres the hologram's light cone starts above the roof. */
  hologramLiftM: 0.6,
} as const;

/** The soft pool of light on the ground around a lit venue, in points: far, middle, near. */
export const GROUND_GLOW = { radius: [10, 30, 80] as const, live: 0.36, expected: 0.2 } as const;

// ── Labels ──────────────────────────────────────────────────────────────────

export const LABEL = {
  size: 16,
  /** The crowd line is a picture (count-*.png) this many points tall, text and its dark edge. */
  countSize: 10.5,
  countHeight: 15,
  selectedSize: 14,
  ghostSize: 12.5,
  /**
   * Closer than this every venue is named; further out only the busy ones and the selected one.
   * The map checks a filter's zoom once per whole zoom level, so in practice this switches at 14.
   */
  allFromZoom: 13.5,
  /** "Busy" for the rule above. */
  minStrength: 0.4,
  /** Points between the tip of the beam and the text above it. */
  gap: 3,
} as const;

// ── Ids ─────────────────────────────────────────────────────────────────────
// Sources and layers are looked up by id inside the map, so each must be unique.

export const SOURCE = {
  route: 'city-route',
  /** One point per venue: the pool of light on the ground. Not tappable: the pool is wide. */
  venueGlow: 'city-venue-glow',
  /** The same points for the 2D discs. */
  venuePoints: 'city-venue-points',
  /** The lit roof edge and corner lines of each venue's building. */
  venueShapes: 'city-venue-shapes',
  /** The same points again, for what stands on the roof: ring, beam, names. */
  venueLights: 'city-venue-lights',
  /** Signs: the slab on the wall, the 3D panel in front of it, and holograms and "Ad" tags. */
  signSlabs: 'city-sign-slabs',
  signPanels: 'city-sign-panels',
  signMarks: 'city-sign-marks',
  /** Friends layer: the friends at each venue. */
  friends: 'city-friends',
} as const;

export const LAYER = {
  waterEdge: 'city-water-edge',
  streetGlow: 'city-street-glow',
  streetCore: 'city-street-core',
  buildings: 'city-buildings',
  roofs: 'city-roofs',
  routeGlow: 'city-route-glow',
  routeLine: 'city-route-line',
  routeCore: 'city-route-core',
  groundGlow: 'city-ground-glow',
  disc: 'city-disc',
  discDot: 'city-disc-dot',
  discRing: 'city-disc-ring',
  roofFrame: 'city-roof-frame',
  cornerPosts: 'city-corner-posts',
  ping: 'city-ping-',
  roofRing: 'city-roof-ring',
  beam: 'city-beam',
  signSlab: 'city-sign-slab',
  signPanel: 'city-sign-panel',
  signHologram: 'city-sign-hologram',
  signTag: 'city-sign-tag',
  friendAvatar: 'city-friend-avatar',
  friendVenue: 'city-friend-venue',
  labelNames: 'city-label-names',
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
