import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale, useReducedMotion } from '@/components/afterglow/motion';
import { Poster } from '@/components/afterglow/poster';
import { Display } from '@/components/afterglow/text';
import { Icon } from '@/components/ui/icon';
import { colors, layout, radii, spacing } from '@/theme';

const CONTROL = layout.minTouchTarget;
/** How far before the hero is gone the bar starts to fill in. */
const BAR_FILL_DISTANCE = 48;

type IconProps = ComponentProps<typeof Icon>;

type ControlProps = {
  sfSymbol: IconProps['sfSymbol'];
  ionicon: IconProps['ionicon'];
  onPress: () => void;
  accessibilityLabel: string;
  selected?: boolean;
  /** `overlay` sits on a poster (dark, nearly opaque); `solid` sits on the plain background. */
  tone?: 'overlay' | 'solid';
};

/** A square control for the top of a page: back, share, favourite. Solid, no blur. */
export function SquareControl({ sfSymbol, ionicon, onPress, accessibilityLabel, selected, tone = 'overlay' }: ControlProps) {
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.92}
      hitSlop={layout.hitSlop}
      style={styles.control}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={selected === undefined ? undefined : { selected }}
    >
      <View style={[StyleSheet.absoluteFill, tone === 'overlay' ? styles.controlOverlay : styles.controlSolid]} />
      <Icon sfSymbol={sfSymbol} ionicon={ionicon} size={20} color={colors.label} />
    </PressableScale>
  );
}

export function BackControl({ tone }: { tone?: ControlProps['tone'] }) {
  return (
    <SquareControl
      sfSymbol="chevron.left"
      ionicon="chevron-back"
      onPress={() => router.back()}
      accessibilityLabel="Back"
      tone={tone}
    />
  );
}

/** A page with only a back control: what a hero page shows while it loads or after it failed. */
export function BackOnlyScreen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom }]}>
      <View style={styles.backOnlyBar}>
        <BackControl tone="solid" />
      </View>
      {children}
    </View>
  );
}

type HeroScrollProps = {
  /** Drawn on the poster when there is no image, and shown in the bar once the hero has scrolled away. */
  title: string;
  imageUrl?: string | null;
  /** Height of the poster. */
  heroHeight: number;
  /** Controls on the right of the bar. */
  actions?: ReactNode;
  /** Room to leave under the content, e.g. for a fixed bottom bar. */
  bottomSpace?: number;
  children: ReactNode;
};

/**
 * A page under a poster. The poster follows the finger: it trails the content at half speed on the way up
 * and stretches from the top edge when pulled down. As it leaves, the title settles into a solid bar.
 */
export function HeroScroll({ title, imageUrl, heroHeight, actions, bottomSpace = 0, children }: HeroScrollProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const barHeight = insets.top + spacing.sm + CONTROL + spacing.sm;
  const settleAt = Math.max(BAR_FILL_DISTANCE, heroHeight - barHeight);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.value = e.contentOffset.y;
    },
  });

  const heroStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { transform: [{ translateY: 0 }, { scale: 1 }] };
    return {
      transform: [
        // Up: half the scroll distance, so the poster trails the content. Down (pulled past the top):
        // half the pull upward, which together with the scale keeps its top edge on the screen's edge.
        { translateY: interpolate(scrollY.value, [-heroHeight, 0, heroHeight], [-heroHeight / 2, 0, heroHeight / 2], Extrapolation.CLAMP) },
        { scale: interpolate(scrollY.value, [-heroHeight, 0], [2, 1], Extrapolation.CLAMP) },
      ],
    };
  });

  const barFillStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [settleAt - BAR_FILL_DISTANCE, settleAt], [0, 1], Extrapolation.CLAMP),
  }));

  const barTitleStyle = useAnimatedStyle(() => {
    const shown = interpolate(scrollY.value, [settleAt - 16, settleAt + 24], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: shown,
      transform: [{ translateY: reduceMotion ? 0 : 10 * (1 - shown) }],
    };
  });

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomSpace }}
      >
        <Animated.View style={[{ height: heroHeight }, heroStyle]}>
          <Poster imageUrl={imageUrl} title={title} titleSize={44} style={StyleSheet.absoluteFill} />
          {/* The poster darkens into the page so the content can start on it. */}
          <LinearGradient colors={['transparent', colors.bg]} style={styles.heroFade} pointerEvents="none" />
        </Animated.View>
        {/* Opaque, so the trailing poster slides away underneath it. */}
        <View style={styles.content}>{children}</View>
      </Animated.ScrollView>

      <View style={[styles.bar, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <Animated.View style={[StyleSheet.absoluteFill, styles.barFill, barFillStyle]} pointerEvents="none" />
        <BackControl />
        <Animated.View style={[styles.barTitle, barTitleStyle]} pointerEvents="none">
          <Display size="xs" numberOfLines={1}>
            {title}
          </Display>
        </Animated.View>
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  backOnlyBar: {
    paddingHorizontal: spacing.base,
  },
  control: {
    width: CONTROL,
    height: CONTROL,
    borderRadius: radii.card,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlOverlay: {
    backgroundColor: colors.bg,
    opacity: 0.86,
  },
  controlSolid: {
    backgroundColor: colors.surface,
  },
  heroFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '40%',
  },
  content: {
    backgroundColor: colors.bg,
  },
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },
  barFill: {
    backgroundColor: colors.bg,
  },
  barTitle: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
