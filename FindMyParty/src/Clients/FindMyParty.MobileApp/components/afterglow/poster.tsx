import { useState } from 'react';
import { Image, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { fonts } from '@/theme';

// The drawn posters are illustrations, so their colours are written out here (BUILD-SPEC §5).
// They are the mock's four looks (.pA–.pD in afterglow-concept.html): coloured light pooling in from the
// edges of a dark sheet, with neon lettering in the poster's own colour.

type Spot = {
  /** Centre, as a share of the poster's width and height. */
  cx: number;
  cy: number;
  /** Radii, as a share of the poster's width and height (CSS `radial-gradient(120% 90% at …)`). */
  rx: number;
  ry: number;
  color: string;
  /** Where the colour has faded out, as a share of the radius. */
  fade: number;
};

type Palette = {
  base: string;
  /** The glow around the sign's letters. */
  glow: string;
  /** Bottom to top: the last one is painted over the others, like the first gradient in CSS. */
  spots: readonly Spot[];
};

const PALETTES: readonly Palette[] = [
  // pA: rose top left, violet top right, orange rising from below.
  {
    base: '#16061f',
    glow: '#ec5b93',
    spots: [
      { cx: 0.5, cy: 1.2, rx: 0.9, ry: 0.8, color: '#ff8c48', fade: 0.6 },
      { cx: 0.95, cy: 0.2, rx: 1, ry: 1, color: '#7d08fa', fade: 0.6 },
      { cx: 0.15, cy: 0, rx: 1.2, ry: 0.9, color: '#ec5b93', fade: 0.55 },
    ],
  },
  // pB: blue top right over indigo from the left.
  {
    base: '#050a22',
    glow: '#22a8ff',
    spots: [
      { cx: 0, cy: 0.4, rx: 1, ry: 1, color: '#5a2bff', fade: 0.6 },
      { cx: 0.85, cy: 0, rx: 1.1, ry: 0.9, color: '#22a8ff', fade: 0.55 },
    ],
  },
  // pC: teal top left, violet bottom right.
  {
    base: '#04140f',
    glow: '#19c7a0',
    spots: [
      { cx: 1, cy: 0.8, rx: 1, ry: 1, color: '#7d08fa', fade: 0.6 },
      { cx: 0.2, cy: 0.1, rx: 1.1, ry: 0.9, color: '#19c7a0', fade: 0.55 },
    ],
  },
  // pD: red top right, crimson bottom left.
  {
    base: '#1a0608',
    glow: '#ff5a3c',
    spots: [
      { cx: 0, cy: 0.9, rx: 1, ry: 1, color: '#c2185b', fade: 0.6 },
      { cx: 0.8, cy: 0.1, rx: 1.1, ry: 0.9, color: '#ff5a3c', fade: 0.55 },
    ],
  },
];

/** The fine dark lines across every drawn poster: one point of shade every three. */
const SCANLINE_EVERY = 3;
const SCANLINE_SHADE = 'rgba(0,0,0,0.22)';
/** Wider than any screen; the poster clips it. */
const SCANLINE_WIDTH = 2000;

/**
 * Mixed into every name before hashing. Any value gives stable looks; this one gives each of the seven
 * demo venues in Podgorica a look of its own (Monkey rose, Kula blue, Blok 5 teal, Dr. House red, …).
 */
const SALT = '168:';

/** A stable, well-spread number for a name: FNV-1a over the salted, lower-cased text, then a final mix. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  const s = SALT + text.trim().toLowerCase();
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // FNV's low bits are weak, and only the low bits pick the look.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Which look a name gets: one of the four palettes, and whether it is drawn mirrored. Eight looks in all,
 * always the same for the same name, so every poster of a venue shares its colours.
 */
export function posterLook(name: string): { palette: number; mirrored: boolean } {
  const n = hash(name) % (PALETTES.length * 2);
  return { palette: n % PALETTES.length, mirrored: n < PALETTES.length };
}

/** The colour of a name's poster light, e.g. for a glow that should match it. */
export function posterGlow(name: string): string {
  return PALETTES[posterLook(name).palette].glow;
}

function scanlinePath(height: number): string {
  let d = '';
  for (let y = 0; y < height; y += SCANLINE_EVERY) d += `M0 ${y}h${SCANLINE_WIDTH}v1H0z`;
  return d;
}

/** Two words or more on two lines, split where the halves are closest in length: "NEON\nFRIDAY". */
function stacked(text: string): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 2) return text;
  let best = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const diff = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length);
    if (diff < bestDiff) {
      best = i;
      bestDiff = diff;
    }
  }
  return `${words.slice(0, best).join(' ')}\n${words.slice(best).join(' ')}`;
}

type Props = {
  /** The venue's own artwork. When missing, a neon poster is drawn. */
  imageUrl?: string | null;
  /** The words on the drawn sign. */
  title: string;
  /** Picks the colours, so all of a venue's posters match. Falls back to `title`. */
  venueName?: string | null;
  style?: StyleProp<ViewStyle>;
  /** Font size of the sign. Default 34. */
  titleSize?: number;
  /** `stack` sets a title of two words or more on two lines, like the party page's poster. Default `wrap`. */
  signLines?: 'wrap' | 'stack';
  /** Moves the sign down from the middle, e.g. to clear the status bar on a page's hero. */
  signOffset?: number;
};

/**
 * A party's or venue's picture. Posters carry the colour in Afterglow; the interface around them stays quiet.
 * With no image it draws the venue's poster: pools of coloured light, fine scanlines, and the name as a neon sign.
 */
export function Poster({ imageUrl, title, venueName, style, titleSize = 34, signLines = 'wrap', signOffset = 0 }: Props) {
  const [height, setHeight] = useState(0);

  if (imageUrl) {
    return (
      <View style={[styles.frame, style]}>
        <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
      </View>
    );
  }

  const key = venueName?.trim() ? venueName : title;
  const { palette: index, mirrored } = posterLook(key);
  const palette = PALETTES[index];
  const idPrefix = `poster-${index}-${mirrored ? 'm' : 'n'}`;

  const sign = signLines === 'stack' ? stacked(title.toUpperCase()) : title.toUpperCase();
  const signStyle = [
    styles.sign,
    {
      fontSize: titleSize,
      lineHeight: Math.round(titleSize * 0.98),
      letterSpacing: titleSize * 0.02,
    },
  ];
  const glowRadius = Math.min(14, Math.max(4, titleSize * 0.3));

  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.ceil(e.nativeEvent.layout.height);
    if (next !== height) setHeight(next);
  };

  return (
    <View style={[styles.frame, { backgroundColor: palette.base }, style]} onLayout={onLayout}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          {palette.spots.map((spot, i) => {
            const cx = mirrored ? 1 - spot.cx : spot.cx;
            return (
              <RadialGradient key={i} id={`${idPrefix}-${i}`} cx={cx} cy={spot.cy} fx={cx} fy={spot.cy} rx={spot.rx} ry={spot.ry}>
                <Stop offset={0} stopColor={spot.color} stopOpacity={1} />
                <Stop offset={spot.fade} stopColor={spot.color} stopOpacity={0} />
              </RadialGradient>
            );
          })}
        </Defs>
        {palette.spots.map((_, i) => (
          <Rect key={i} x={0} y={0} width="100%" height="100%" fill={`url(#${idPrefix}-${i})`} />
        ))}
        {height > 0 ? <Path d={scanlinePath(height)} fill={SCANLINE_SHADE} /> : null}
      </Svg>

      {/* A sign is a light: white letters with a tight white halo, inside a wider halo in the poster's colour. */}
      <View style={[styles.signBox, signOffset ? { transform: [{ translateY: signOffset }] } : null]} pointerEvents="none">
        <Text
          style={[signStyle, { textShadowColor: palette.glow, textShadowRadius: glowRadius }]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {sign}
        </Text>
        <Text
          style={[signStyle, styles.signFront]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {sign}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#12061f',
  },
  signBox: {
    alignSelf: 'stretch',
    paddingHorizontal: 6,
  },
  sign: {
    fontFamily: fonts.display,
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowOffset: { width: 0, height: 0 },
  },
  signFront: {
    position: 'absolute',
    top: 0,
    left: 6,
    right: 6,
    textShadowColor: 'rgba(255,255,255,0.9)',
    textShadowRadius: 2,
  },
});
