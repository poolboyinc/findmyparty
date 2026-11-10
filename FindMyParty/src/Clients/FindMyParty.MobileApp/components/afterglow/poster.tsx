import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { fonts } from '@/theme';

type Props = {
  /** The venue's own artwork. When missing, a typographic poster is drawn from `title`. */
  imageUrl?: string | null;
  title: string;
  style?: StyleProp<ViewStyle>;
  /** Font size of the title on the drawn poster. Default 34. */
  titleSize?: number;
};

// Deep two-colour washes for drawn posters. Chosen by the title, so a party always gets the same one.
const WASHES: readonly (readonly [string, string, string])[] = [
  ['#3b0f52', '#8a1f5e', '#1a0a24'],
  ['#0d1f5c', '#3a1bd6', '#070b22'],
  ['#0c3b33', '#3b1f7a', '#06140f'],
  ['#5c1a12', '#7a1548', '#1a0608'],
];

function washFor(title: string) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) >>> 0;
  return WASHES[hash % WASHES.length];
}

/**
 * A party's or venue's picture. Posters carry the colour in Afterglow; the interface around them stays quiet.
 * With no image it draws a dark poster with the title set large, like a flyer.
 */
export function Poster({ imageUrl, title, style, titleSize = 34 }: Props) {
  if (imageUrl) {
    return (
      <View style={[styles.frame, style]}>
        <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
      </View>
    );
  }

  const [a, b, c] = washFor(title);
  return (
    <View style={[styles.frame, style]}>
      <LinearGradient colors={[a, b, c]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Text
        style={[styles.title, { fontSize: titleSize, lineHeight: titleSize * 1.02 }]}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
      >
        {title.toUpperCase()}
      </Text>
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
  title: {
    fontFamily: fonts.display,
    color: '#FFFFFF',
    textAlign: 'center',
    paddingHorizontal: 12,
    // A sign is a light, so it may glow a little.
    textShadowColor: 'rgba(255,255,255,0.45)',
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 0 },
  },
});
