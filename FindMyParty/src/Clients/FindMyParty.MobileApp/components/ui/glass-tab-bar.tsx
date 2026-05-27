import { useEffect, useRef, useState } from 'react';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Dimensions, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { SymbolViewProps } from 'expo-symbols';
import type { Ionicons } from '@expo/vector-icons';
import { Icon } from '@/components/ui/icon';
import { colors, layout, radii, spacing, typography, weights } from '@/theme';

type TabIcons = {
  /** Filled SF Symbol used when the tab is the active route. */
  sfSymbolActive: SymbolViewProps['name'];
  /** Outline SF Symbol used when the tab is not active. */
  sfSymbolInactive: SymbolViewProps['name'];
  /** Filled Ionicon used when the tab is the active route (Android/web fallback). */
  ioniconActive: keyof typeof Ionicons.glyphMap;
  /** Outline Ionicon used when the tab is not active (Android/web fallback). */
  ioniconInactive: keyof typeof Ionicons.glyphMap;
};

/** Per-route icon set + label. Keyed by the route's file-based name. */
export type TabIconMap = Record<string, TabIcons & { label: string }>;

type Props = BottomTabBarProps & {
  iconMap: TabIconMap;
};

const ICON_SIZE = 26;
// Sized to contain the 41pt icon+gap+label block with ~6pt cushion above and
// below, leaving ~5pt of tab-bar frame visible around the bubble. Pill-shaped
// (radius = height/2 = 27pt). Don't shrink — content overflows below ~52pt.
const ACTIVE_BUBBLE_HEIGHT = 54;
const ROW_PADDING = spacing.xs;
const BUBBLE_INSET = spacing.sm;
// Spring matches the spec from Phase 1 (damping 20, stiffness 300, mass 0.8).
const BUBBLE_SPRING = { damping: 20, stiffness: 300, mass: 0.8 } as const;

/**
 * Floating glass tab bar. Blur material with a 1px inner top highlight, soft
 * drop shadow, and a single active-tab bubble that springs between positions.
 * Bottom safe-area inset is applied to the bar's `bottom` offset, not its
 * `paddingBottom`, so the pill visually clears the home indicator.
 */
export function GlassTabBar({ state, navigation, iconMap }: Props) {
  const insets = useSafeAreaInsets();
  // Pre-compute the expected container width so the bubble has a valid
  // position from the very first frame, before `onLayout` fires. The estimate
  // matches the `container` style's horizontal margins (`left: spacing.base,
  // right: spacing.base`); onLayout corrects any drift via setContainerWidth.
  const [containerWidth, setContainerWidth] = useState(
    Dimensions.get('window').width - spacing.base * 2,
  );

  const numTabs = state.routes.length;
  const tabWidth = containerWidth > 0 ? (containerWidth - ROW_PADDING * 2) / numTabs : 0;

  const bubbleX = useSharedValue(0);
  const firstLayoutRef = useRef(true);

  // On state.index change: spring to the new tab's position.
  useEffect(() => {
    if (tabWidth === 0) return;
    const target = state.index * tabWidth;
    if (firstLayoutRef.current) {
      bubbleX.value = target;
      firstLayoutRef.current = false;
    } else {
      bubbleX.value = withSpring(target, BUBBLE_SPRING);
    }
  }, [state.index, tabWidth, bubbleX]);

  // On tabWidth change (e.g. rotation): snap without animation.
  useEffect(() => {
    if (tabWidth === 0) return;
    bubbleX.value = state.index * tabWidth;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabWidth]);

  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: bubbleX.value }],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.container,
        { bottom: insets.bottom + layout.floatingTabBarBottomOffset },
      ]}
    >
      <View style={styles.shadowWrap}>
        <BlurView intensity={50} tint="dark" style={styles.blur} onLayout={onLayout}>
          {/* Top inner highlight — simulates edge-of-glass refraction. */}
          <View pointerEvents="none" style={styles.topHighlight} />

          {/* Single sprung bubble — slides between tabs on selection. */}
          {tabWidth > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.activeBubble,
                {
                  left: ROW_PADDING + BUBBLE_INSET,
                  width: tabWidth - BUBBLE_INSET * 2,
                },
                bubbleStyle,
              ]}
            />
          ) : null}

          {state.routes.map((route, index) => {
            const def = iconMap[route.name];
            if (!def) return null;

            const isFocused = state.index === index;
            const tintColor = isFocused ? colors.tint : colors.labelSecondary;

            const onPress = () => {
              Haptics.selectionAsync();
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={def.label}
                style={styles.tab}
              >
                <Icon
                  sfSymbol={isFocused ? def.sfSymbolActive : def.sfSymbolInactive}
                  ionicon={isFocused ? def.ioniconActive : def.ioniconInactive}
                  size={ICON_SIZE}
                  color={tintColor}
                />
                <Text
                  style={[styles.label, { color: tintColor }]}
                  numberOfLines={1}
                  allowFontScaling
                >
                  {def.label}
                </Text>
              </Pressable>
            );
          })}
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.base,
    right: spacing.base,
    // `bottom` applied inline via safe-area insets + floatingTabBarBottomOffset.
  },
  shadowWrap: {
    borderRadius: radii.xxl,
    backgroundColor: 'transparent',
    // Soft drop shadow beneath the floating pill — locked spec.
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
  },
  blur: {
    height: layout.floatingTabBarHeight,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.xxl,
    overflow: 'hidden',
    paddingHorizontal: ROW_PADDING,
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  tab: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  activeBubble: {
    position: 'absolute',
    top: (layout.floatingTabBarHeight - ACTIVE_BUBBLE_HEIGHT) / 2,
    height: ACTIVE_BUBBLE_HEIGHT,
    borderRadius: ACTIVE_BUBBLE_HEIGHT / 2,
    backgroundColor: colors.brand.tintBg,
  },
  label: {
    ...typography.caption2,
    fontWeight: weights.semibold,
    letterSpacing: 0.2,
  },
});
