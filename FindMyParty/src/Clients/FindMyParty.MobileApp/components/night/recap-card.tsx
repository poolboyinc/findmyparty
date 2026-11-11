import { forwardRef, useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { PressableScale, springs, useReducedMotion } from '@/components/afterglow/motion';
import { Display } from '@/components/afterglow/text';
import { RecapMap } from '@/components/city/recap-map';
import { alpha } from '@/components/pass/format';
import { Icon } from '@/components/ui/icon';
import type { NightRecap } from '@/types/api';
import { colors, radii, spacing, typography } from '@/theme';
import { ownerLine, recapDateLine, recapStats } from './recap';

/** The card's own dark, a touch bluer than the screen, as on the mock (S-16). It is what a shared image shows. */
const CARD = '#0B0916';
const CARD_CLEAR = alpha(CARD, 0);

// Shares of the card's width, from the mock's 262-wide card.
const MAP_HEIGHT = 210 / 262;
const FADE_TOP = 120 / 262;
const FADE_HEIGHT = 92 / 262;
const CONTENT_TOP = 196 / 262;
const CONTENT_BOTTOM = 43 / 262;
/** Column widths of the four stats, as drawn. */
const STAT_FLEX = { out: 1.25, venues: 0.8, glow: 1, mostly: 1.1 } as const;

type Props = {
  recap: NightRecap;
  /** Width of the card in points. */
  width: number;
};

/**
 * The night recap card (S-16): the night city with the venues lit and the line between them, the date
 * and city, the headline, four numbers, and the logo with "@handle, level". Venues only, never times.
 * The ref is the card's view, for saving it as an image (`collapsable` off so it can be captured).
 * The card settles in once; that is the screen's one entrance.
 */
export const RecapCard = forwardRef<View, Props>(function RecapCard({ recap, width }, ref) {
  const reduceMotion = useReducedMotion();
  const stats = recapStats(recap);

  const arrival = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (!reduceMotion) arrival.set(withSpring(1, springs.arrive));
  }, [arrival, reduceMotion]);
  const arrivalStyle = useAnimatedStyle(() => {
    const progress = arrival.get();
    return {
      opacity: Math.min(1, Math.max(0, progress * 2)),
      transform: [{ translateY: (1 - progress) * 24 }, { scale: 0.96 + 0.04 * progress }],
    };
  });

  return (
    <Animated.View style={arrivalStyle}>
      <View ref={ref} collapsable={false} style={[styles.card, { width }]}>
        <RecapMap venues={recap.venues} style={[styles.map, { height: width * MAP_HEIGHT }]} />
        <LinearGradient
          colors={[CARD_CLEAR, CARD]}
          pointerEvents="none"
          style={[styles.fade, { top: width * FADE_TOP, height: width * FADE_HEIGHT }]}
        />
        <Text style={styles.date}>{recapDateLine(recap.date, recap.cityName)}</Text>

        <View style={[styles.content, { paddingTop: width * CONTENT_TOP, paddingBottom: width * CONTENT_BOTTOM }]}>
          <Display style={styles.headline} accessibilityRole="header">
            {recap.headline}
          </Display>

          <View style={styles.stats}>
            {stats.map((stat) => (
              <View key={stat.key} style={[styles.stat, { flex: STAT_FLEX[stat.key] }]} accessible accessibilityLabel={`${stat.label}: ${stat.value}`}>
                <Display color={stat.earned ? colors.earned : colors.label} style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                  {stat.value}
                </Display>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.brand}>
            <View style={styles.brandLeft}>
              <View style={styles.logoBox} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Image source={require('@/assets/images/fmp_logo.png')} style={styles.logo} resizeMode="contain" />
              </View>
              <Display style={styles.wordmark}>FindMyParty</Display>
            </View>
            <Text style={styles.owner} numberOfLines={1}>
              {ownerLine(recap.handle, recap.levelName)}
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
});

type HeaderProps = {
  title: string;
  onClose: () => void;
};

/** "✕" on the left, the screen's name in the middle, as on the mock. */
export function RecapHeader({ title, onClose }: HeaderProps) {
  return (
    <View style={styles.header}>
      <PressableScale onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Close">
        <Icon sfSymbol="xmark" ionicon="close" size={16} color={colors.label} />
      </PressableScale>
      <Text style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.close} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'center',
    backgroundColor: CARD,
    borderRadius: radii.ticket + 2,
    overflow: 'hidden',
  },
  map: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  date: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.label,
    position: 'absolute',
    top: spacing.lg - 1,
    left: spacing.lg - 1,
    right: spacing.lg - 1,
    textShadowColor: alpha(colors.bg, 0.9),
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  content: {
    paddingHorizontal: spacing.lg - 1,
  },
  headline: {
    fontSize: 41,
    lineHeight: 43,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg - 1,
  },
  stat: {
    minWidth: 0,
    gap: spacing.xs,
  },
  statValue: {
    fontSize: 26,
    lineHeight: 28,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    ...typography.caption1,
    fontSize: 11,
    fontWeight: '500',
    color: colors.labelTertiary,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.lg + 2,
    paddingTop: spacing.md + 2,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: colors.hairline,
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // The logo file has room around the mark: a 42 pt square shows a 19 × 30 pt mark.
  logoBox: {
    width: 19,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  logo: {
    width: 42,
    height: 42,
  },
  wordmark: {
    fontSize: 18,
    lineHeight: 20,
  },
  owner: {
    ...typography.caption1,
    fontWeight: '600',
    color: colors.labelTertiary,
    flexShrink: 1,
    textAlign: 'right',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  close: {
    width: 41,
    height: 41,
    borderRadius: radii.chip + 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.footnote,
    fontWeight: '600',
    color: colors.labelTertiary,
    flexShrink: 1,
    textAlign: 'center',
  },
});
