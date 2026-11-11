// Signs in the city (S-19): a panel on a hand-picked wall, or a hologram floating over a roof.
// Pure: no React, no map, no `@/` imports (unit-tested in plain Node: services/__tests__/signs.test.mjs).
//
// The pictures come from the server's sign-art endpoints, which draw a sign from its text and
// colours. The address carries everything in its path (no query string: the iOS map drops the
// query when it fetches a 3D model).

type Position = number[];

/** What the map needs of a sign; `MapSign` from the API has exactly these (and more). */
export type SignOnMap = {
  id: string;
  format: 'facade' | 'hologram';
  /** A venue's own wall: drawn without the "Ad" tag. */
  own: boolean;
  /** "VOLT", "AURA|SPRITZ": `|` starts a new line. */
  text: string;
  colorTop: string;
  colorBottom: string;
  ink: string;
  spot: {
    /** Middle of the wall at ground level; for a hologram the middle of the roof. */
    latitude: number;
    longitude: number;
    /** The way the wall faces, clockwise from north. */
    bearingDeg: number;
    /** Bottom edge of the panel above the ground, and the panel's size, in metres. */
    baseHeightM: number;
    widthM: number;
    heightM: number;
    buildingHeightM: number;
  };
};

export type SignArtKind = 'face' | 'hologram' | 'panel';

const METRES_PER_DEGREE = (Math.PI / 180) * 6_371_008.8;
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** UTF-8 bytes of a string (no TextEncoder needed). */
function utf8(text: string): number[] {
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000) bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    else bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
  }
  return bytes;
}

/** URL-safe base64 without padding: only letters, digits, `-` and `_`. */
export function base64Url(text: string): string {
  const bytes = utf8(text);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += B64[a >> 2];
    out += B64[((a & 3) << 4) | ((b ?? 0) >> 4)];
    if (b !== undefined) out += B64[((b & 15) << 2) | ((c ?? 0) >> 6)];
    if (c !== undefined) out += B64[c & 63];
  }
  return out;
}

const hex = (color: string) => color.replace('#', '').toLowerCase();

/**
 * Everything the server needs to draw a sign, packed into one path-safe word:
 * `v1`, top colour, bottom colour, ink, width and height in metres, text; one per line.
 */
export function signArtCode(sign: Pick<SignOnMap, 'text' | 'colorTop' | 'colorBottom' | 'ink'> & { spot: Pick<SignOnMap['spot'], 'widthM' | 'heightM'> }): string {
  const round = (n: number) => String(Math.round(n * 10) / 10);
  return base64Url(
    ['v1', hex(sign.colorTop), hex(sign.colorBottom), hex(sign.ink), round(sign.spot.widthM), round(sign.spot.heightM), sign.text].join('\n'),
  );
}

/** Where the server draws this sign: the flat face (PNG), the hologram (PNG) or the wall panel (GLB). */
export function signArtUrl(apiBase: string, sign: Parameters<typeof signArtCode>[0], kind: SignArtKind): string {
  const extension = kind === 'panel' ? 'glb' : 'png';
  return `${apiBase.replace(/\/$/, '')}/api/sign-art/${kind}/${signArtCode(sign)}.${extension}`;
}

/** The name a sign's picture or 3D panel is registered under on the map. */
export function signImageName(sign: SignOnMap): string {
  return `sign-${sign.format}-${signArtCode(sign)}`;
}

/** A coordinate moved `metres` in the direction `bearingDeg` (clockwise from north). */
export function move(at: Position, bearingDeg: number, metres: number): Position {
  const angle = (bearingDeg * Math.PI) / 180;
  const cosLat = Math.max(Math.cos((at[1] * Math.PI) / 180), 1e-6);
  return [
    at[0] + (Math.sin(angle) * metres) / (METRES_PER_DEGREE * cosLat),
    at[1] + (Math.cos(angle) * metres) / METRES_PER_DEGREE,
  ];
}

/** How far the fall-back slab and the panel stand in front of the wall, in metres. */
export const SIGN_OFFSET = { slabNearM: 0.1, slabFarM: 0.3, panelM: 0.5 } as const;

type Feature<G, P> = { type: 'Feature'; properties: P; geometry: G };
type Collection<G, P> = { type: 'FeatureCollection'; features: Feature<G, P>[] };
type PointGeometry = { type: 'Point'; coordinates: Position };
type PolygonGeometry = { type: 'Polygon'; coordinates: Position[][] };

export type SignPanelProps = {
  id: string;
  /** The 3D panel's name (registered with its GLB address). */
  model: string;
  /** Degrees about the x, y and z axes: the panel is drawn facing south and turned to face the wall's way. */
  rotation: [number, number, number];
  /** Metres: width, depth (unused), height. The model is one metre wide and one metre tall. */
  scale: [number, number, number];
  /** Metres east, north and up from the point. */
  translation: [number, number, number];
};

export type SignSlabProps = { id: string; fill: string; base: number; top: number };

export type SignMarkProps = {
  id: string;
  /** 'hologram': the floating sign itself. 'tag': the amber "Ad" block over a paid panel. */
  kind: 'hologram' | 'tag';
  /** The picture to draw. */
  image: string;
  /** Metres above the ground where it stands (before the map's vertical stretch). */
  z: number;
};

export type SignFeatures = {
  /** One point per wall panel: where its 3D model stands. */
  panels: Collection<PointGeometry, SignPanelProps>;
  /** A thin coloured slab on the wall under each panel: what shows if the 3D panel cannot be drawn. */
  slabs: Collection<PolygonGeometry, SignSlabProps>;
  /** Holograms and "Ad" tags. */
  marks: Collection<PointGeometry, SignMarkProps>;
};

/** The picture name of the "Ad" tag (assets/images/city/ad-tag.png). */
export const AD_TAG_IMAGE = 'ad-tag';

/**
 * Signs as what the map draws.
 * `stretch` is the map's vertical stretch (BUILDINGS.stretch): 3D panels are sized in real metres
 * by the map, so their height and lift are stretched here; slabs and marks are stretched by their
 * layer styles like every other height.
 */
export function signFeatures(signs: readonly SignOnMap[], stretch: number): SignFeatures {
  const panels: SignFeatures['panels'] = { type: 'FeatureCollection', features: [] };
  const slabs: SignFeatures['slabs'] = { type: 'FeatureCollection', features: [] };
  const marks: SignFeatures['marks'] = { type: 'FeatureCollection', features: [] };

  for (const sign of signs) {
    const { spot } = sign;
    const at: Position = [spot.longitude, spot.latitude];
    if (!Number.isFinite(at[0]) || !Number.isFinite(at[1])) continue;

    if (sign.format === 'hologram') {
      marks.features.push({
        type: 'Feature',
        properties: { id: sign.id, kind: 'hologram', image: signImageName(sign), z: spot.buildingHeightM },
        geometry: { type: 'Point', coordinates: at },
      });
      continue;
    }

    const facing = spot.bearingDeg;
    const along = facing + 90;
    const half = spot.widthM / 2;
    const top = spot.baseHeightM + spot.heightM;

    panels.features.push({
      type: 'Feature',
      properties: {
        id: sign.id,
        model: signImageName(sign),
        // The model faces south (180°) when not turned; turning is clockwise seen from above.
        rotation: [0, 0, facing - 180],
        scale: [spot.widthM, 1, spot.heightM * stretch],
        translation: [0, 0, spot.baseHeightM * stretch],
      },
      geometry: { type: 'Point', coordinates: move(at, facing, SIGN_OFFSET.panelM) },
    });

    const near = move(at, facing, SIGN_OFFSET.slabNearM);
    const far = move(at, facing, SIGN_OFFSET.slabFarM);
    const ring = [move(near, along, -half), move(near, along, half), move(far, along, half), move(far, along, -half)];
    slabs.features.push({
      type: 'Feature',
      properties: { id: sign.id, fill: sign.colorTop, base: spot.baseHeightM, top },
      geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]]] },
    });

    if (!sign.own) {
      marks.features.push({
        type: 'Feature',
        properties: { id: sign.id, kind: 'tag', image: AD_TAG_IMAGE, z: top },
        // Over the panel's top edge, towards its left end as you face it.
        geometry: { type: 'Point', coordinates: move(move(at, facing, SIGN_OFFSET.panelM), along, half * 0.6) },
      });
    }
  }
  return { panels, slabs, marks };
}

/**
 * The signs to draw: those inside the part of the city on screen, in the server's order
 * (it sends them by priority), at most `limit` (the design allows three in view).
 */
export function signsInView(
  signs: readonly SignOnMap[],
  bounds: { west: number; south: number; east: number; north: number } | null,
  limit = 3,
): SignOnMap[] {
  const inside = bounds
    ? signs.filter(
        ({ spot }) =>
          spot.longitude >= bounds.west && spot.longitude <= bounds.east && spot.latitude >= bounds.south && spot.latitude <= bounds.north,
      )
    : signs.slice();
  return inside.slice(0, limit);
}
