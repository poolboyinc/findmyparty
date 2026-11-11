import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme';
import { signLines } from './sign-text';

type Props = {
  /** The words, `|` between two lines: "NEON|FRIDAY". */
  text: string;
  colorTop: string;
  colorBottom: string;
  ink: string;
  /** An uploaded image, drawn instead of the colours and words. */
  artworkUrl?: string | null;
  /** Side of the square in points, or the height when `wide`. */
  size: number;
  /** A panel twice as wide as it is high, for the editor's large preview. */
  wide?: boolean;
  style?: StyleProp<ViewStyle>;
};

// CSS `linear-gradient(160deg, top, bottom)`: from the top, a little left of centre, to the bottom.
const START = { x: 0.33, y: 0 };
const END = { x: 0.67, y: 1 };

/**
 * A sign as a flat tile: its two colours from top to bottom and its words in Coolvetica in its ink,
 * like the "VOLT" tile on the sponsored card (S-19) and the thumb on "Your sign" (S-20).
 * It is the sign's own art, so it is the one place a gradient belongs.
 */
export function SignTile({ text, colorTop, colorBottom, ink, artworkUrl, size, wide = false, style }: Props) {
  const width = wide ? size * 2 : size;
  const frame = [styles.frame, { width, height: size, borderRadius: Math.round(size * 0.25) }, style];

  if (artworkUrl) {
    return (
      <View style={frame}>
        <Image source={{ uri: artworkUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
      </View>
    );
  }

  const lines = signLines(text).map((line) => line.trim()).filter(Boolean);
  const longest = Math.max(1, ...lines.map((line) => line.length));
  // Fit the longest line across about 80% of the tile, and never taller than a third of it per line.
  const fontSize = Math.min((width * 0.8) / (longest * 0.55), (size * 0.8) / Math.max(1, lines.length) / 1.05, size * 0.34);

  return (
    <View style={frame}>
      <LinearGradient colors={[colorTop, colorBottom]} start={START} end={END} style={StyleSheet.absoluteFill} />
      <Text
        style={[styles.words, { color: ink, fontSize, lineHeight: Math.round(fontSize * 1.02) }]}
        numberOfLines={2}
        adjustsFontSizeToFit
        allowFontScaling={false}
      >
        {lines.join('\n')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  words: {
    fontFamily: fonts.display,
    textAlign: 'center',
    letterSpacing: -0.3,
    paddingHorizontal: 2,
  },
});
