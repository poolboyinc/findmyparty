import { StyleSheet, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import type { SymbolViewProps } from 'expo-symbols';
import type { Ionicons } from '@expo/vector-icons';
import { Icon } from '@/components/ui/icon';
import type { BadgeId, GlowBadge } from '@/types/api';
import { colors, spacing } from '@/theme';

/** The mock's 40 x 44 pt hexagon at phone scale. */
const WIDTH = 54;
const HEIGHT = 59;
const HEX = `${WIDTH / 2},0 ${WIDTH},${HEIGHT / 4} ${WIDTH},${(HEIGHT * 3) / 4} ${WIDTH / 2},${HEIGHT} 0,${(HEIGHT * 3) / 4} 0,${HEIGHT / 4}`;

const ICONS: Record<BadgeId, { sfSymbol: SymbolViewProps['name']; ionicon: keyof typeof Ionicons.glyphMap }> = {
  'first-night': { sfSymbol: 'flame', ionicon: 'flame-outline' },
  'before-midnight': { sfSymbol: 'clock', ionicon: 'time-outline' },
  explorer: { sfSymbol: 'building.2', ionicon: 'business-outline' },
  'brought-a-friend': { sfSymbol: 'person.2', ionicon: 'people-outline' },
  regular: { sfSymbol: 'star', ionicon: 'star-outline' },
};

function Hex({ badge }: { badge: GlowBadge }) {
  // A badge this build does not know yet still gets a hexagon.
  const icon = ICONS[badge.id] ?? ICONS.regular;
  const progress = badge.earned ? 'earned' : badge.need > 1 ? `${Math.min(badge.have, badge.need)} of ${badge.need}` : 'not earned yet';
  return (
    <View
      style={styles.hex}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${badge.label}, ${progress}`}
      accessibilityHint={badge.hint}
    >
      <Svg width={WIDTH} height={HEIGHT} style={StyleSheet.absoluteFill}>
        <Polygon points={HEX} fill={badge.earned ? colors.earned : colors.surface} />
      </Svg>
      <Icon sfSymbol={icon.sfSymbol} ionicon={icon.ionicon} size={21} color={badge.earned ? colors.ink : colors.labelTertiary} />
    </View>
  );
}

/** The five badges as hexagons (`GlowSummary.badges`): lime with a dark icon when earned, dim until then. */
export function BadgeRow({ badges }: { badges: GlowBadge[] }) {
  return (
    <View style={styles.row}>
      {badges.map((badge) => (
        <Hex key={badge.id} badge={badge} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md - 1,
  },
  hex: {
    width: WIDTH,
    height: HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
