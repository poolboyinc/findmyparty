import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import type { SymbolViewProps } from 'expo-symbols';
import { Icon } from '@/components/ui/icon';
import { colors, spacing, typography } from '@/theme';
import { distanceText } from './directions';

type Direction = 'left' | 'right' | 'straight' | 'back' | 'arrive';

type Props = {
  /** "Left on Njegoševa", "Arrive at Monkey". */
  title: string;
  direction: Direction;
  /** Metres to the manoeuvre from where you are (or from the start, before a position arrives). */
  metres: number;
};

const ARROW: Record<Direction, { sf: SymbolViewProps['name']; ion: 'arrow-back' | 'arrow-forward' | 'arrow-up' | 'return-down-back' | 'location' }> = {
  left: { sf: 'arrow.turn.up.left', ion: 'arrow-back' },
  right: { sf: 'arrow.turn.up.right', ion: 'arrow-forward' },
  straight: { sf: 'arrow.up', ion: 'arrow-up' },
  back: { sf: 'arrow.uturn.down', ion: 'return-down-back' },
  arrive: { sf: 'mappin', ion: 'location' },
};

/**
 * S-06's banner at the top: the next manoeuvre of the walk and how far away it is.
 * It moves on to the next one as you reach each manoeuvre (useCity).
 */
export function TurnBanner({ title, direction, metres }: Props) {
  const arrow = ARROW[direction];
  return (
    <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.banner} accessibilityRole="summary">
      <View style={styles.square}>
        <Icon sfSymbol={arrow.sf} ionicon={arrow.ion} size={23} color={colors.ink} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.distance}>{`In ${distanceText(metres)}`}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: colors.surface,
    borderRadius: 22,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  square: {
    width: 40,
    height: 40,
    borderRadius: 9,
    backgroundColor: colors.you,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.callout,
    fontWeight: '600',
    color: colors.label,
  },
  distance: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.you,
    fontVariant: ['tabular-nums'],
  },
});
