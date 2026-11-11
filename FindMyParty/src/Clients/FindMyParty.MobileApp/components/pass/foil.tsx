import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { Icon } from '@/components/ui/icon';
import { colors, radii } from '@/theme';

/**
 * The foil on a pass: cyan, violet, rose, amber, lime, twice over so it can slide a full band
 * either way. Drawn at twice the width of its window and moved sideways by `tilt` (-1 to 1).
 */
const FOIL = [
  colors.you,
  colors.quiet,
  colors.crowd,
  colors.paid,
  colors.earned,
  colors.you,
  colors.quiet,
  colors.crowd,
  colors.paid,
  colors.earned,
  colors.you,
] as const;

const STRIPE_HEIGHT = 10;
const SEAL_SIZE = 36;
/** How much of the spare half-width the foil travels at full tilt. */
const TRAVEL = 0.9;

type StripeProps = {
  tilt: SharedValue<number>;
  /** Width of the ticket, so the foil knows how far it can slide. */
  width: number;
};

/** The foil band across the ticket. */
export function FoilStripe({ tilt, width }: StripeProps) {
  const slide = useAnimatedStyle(() => ({
    transform: [{ translateX: -width / 2 + tilt.get() * (width / 2) * TRAVEL }],
  }));

  return (
    <View style={[styles.stripe, { width }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.sheet, { width: width * 2 }, slide]}>
        <LinearGradient colors={FOIL} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

/** The round foil seal in the ticket's corner. It catches the light the other way to the band. */
export function FoilSeal({ tilt }: { tilt: SharedValue<number> }) {
  const slide = useAnimatedStyle(() => ({
    transform: [{ translateX: -SEAL_SIZE - tilt.get() * SEAL_SIZE * TRAVEL }],
  }));

  return (
    <View style={styles.seal} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.sheet, { width: SEAL_SIZE * 3 }, slide]}>
        <LinearGradient colors={FOIL} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Icon sfSymbol="flame" ionicon="flame-outline" size={16} color={colors.ink} />
    </View>
  );
}

const styles = StyleSheet.create({
  stripe: {
    height: STRIPE_HEIGHT,
    overflow: 'hidden',
  },
  sheet: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
  seal: {
    width: SEAL_SIZE,
    height: SEAL_SIZE,
    borderRadius: radii.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
