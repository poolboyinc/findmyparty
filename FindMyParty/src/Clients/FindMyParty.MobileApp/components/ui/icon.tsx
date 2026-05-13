import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';

type Props = {
  /** SF Symbol name used on iOS (e.g. "flame.fill", "heart", "chevron.down"). */
  sfSymbol: SymbolViewProps['name'];
  /** Ionicons fallback used on Android / web. Both props are required to prevent
   *  silent rendering failures off-iOS. */
  ionicon: keyof typeof Ionicons.glyphMap;
  /** Rendered size in points. Default 24. */
  size?: number;
  /** Tint color applied to the glyph. */
  color?: string;
};

/**
 * Minimal platform-routing icon. iOS → SF Symbol via expo-symbols; everything
 * else → Ionicons. No semantic variants or theming — consumers choose the
 * matching symbol/ionicon names per usage site.
 */
export function Icon({ sfSymbol, ionicon, size = 24, color }: Props) {
  if (Platform.OS === 'ios') {
    return (
      <SymbolView
        name={sfSymbol}
        size={size}
        tintColor={color}
        resizeMode="scaleAspectFit"
      />
    );
  }
  return <Ionicons name={ionicon} size={size} color={color} />;
}
